'use strict';
var PRISTINE_CLASS = 'ng-pristine',
  DIRTY_CLASS = 'ng-dirty';

var Module = angular.module('datePicker');

Module.constant('dateTimeConfig', {
  template: function (attrs, id) {
    return '' +
      '<div ' +
      (id ? 'id="' + id + '" ' : '') +
      'date-picker="' + attrs.ngModel + '" ' +
      (attrs.view ? 'view="' + attrs.view + '" ' : '') +
      (attrs.maxView ? 'max-view="' + attrs.maxView + '" ' : '') +
      (attrs.maxDate ? 'max-date="' + attrs.maxDate + '" ' : '') +
      (attrs.required ? 'required="' + attrs.required + '" ' : '') +
      (attrs.autoClose ? 'auto-close="' + attrs.autoClose + '" ' : '') +
      (attrs.template ? 'template="' + attrs.template + '" ' : '') +
      (attrs.minView ? 'min-view="' + attrs.minView + '" ' : '') +
      (attrs.minDate ? 'min-date="' + attrs.minDate + '" ' : '') +
      (attrs.partial ? 'partial="' + attrs.partial + '" ' : '') +
      (attrs.step ? 'step="' + attrs.step + '" ' : '') +
      (attrs.onSetDate ? 'date-change="' + attrs.onSetDate + '" ' : '') +
      (attrs.ngModel ? 'ng-model="' + attrs.ngModel + '" ' : '') +
      (attrs.firstDay ? 'first-day="' + attrs.firstDay + '" ' : '') +
      (attrs.timezone ? 'timezone="' + attrs.timezone + '" ' : '') +
      'class="date-picker-date-time"></div>';
  },
  format: 'YYYY-MM-DD HH:mm',
  views: ['date', 'year', 'month', 'hours', 'minutes'],
  autoClose: false,
  position: 'absolute'
});

Module.directive('dateTimeAppend', function () {
  return {
    link: function (scope, element) {
      element.bind('click', function () {
        element.find('input')[0].focus();
      });
    }
  };
});

Module.directive('dateTime', ['$compile', '$document', '$filter', '$window', '$timeout', 'dateTimeConfig', '$parse', 'datePickerUtils', function ($compile, $document, $filter, $window, $timeout, dateTimeConfig, $parse, datePickerUtils) {
  var body = $document.find('body');
  var dateFilter = $filter('mFormat');

  return {
    require: 'ngModel',
    scope: true,
    link: function (scope, element, attrs, ngModel) {
      var format = attrs.format || dateTimeConfig.format,
        parentForm = element.inheritedData('$formController'),
        views = $parse(attrs.views)(scope) || dateTimeConfig.views.concat(),
        view = attrs.view || views[0],
        index = views.indexOf(view),
        dismiss = attrs.autoClose ? $parse(attrs.autoClose)(scope) : dateTimeConfig.autoClose,
        picker = null,
        pickerID = element[0].id,
        position = attrs.position || dateTimeConfig.position,
        container = null,
        minDate = null,
        minValid = null,
        maxDate = null,
        maxValid = null,
        timezone = attrs.timezone || false,
        eventIsForPicker = datePickerUtils.eventIsForPicker,
        dateChange = null,
        shownOnce = false,
        template;

      if (index === -1) {
        views.splice(index, 1);
      }

      views.unshift(view);

      function formatter(value) {
        if (value) {
          return dateFilter(value, format, timezone);
        }
      }

      function parser(viewValue) {
        if (!viewValue) {
          return '';
        }
        var parsed = moment(viewValue, format);
        if (parsed.isValid()) {
          return parsed;
        }
      }

      function setMin(date) {
        minDate = date;
        attrs.minDate = date ? date.format() : date;
        minValid = moment.isMoment(date);
      }

      function setMax(date) {
        maxDate = date;
        attrs.maxDate = date ? date.format() : date;
        maxValid = moment.isMoment(date);
      }

      ngModel.$formatters.push(formatter);
      ngModel.$parsers.unshift(parser);

      if (angular.isDefined(attrs.minDate)) {
        setMin(datePickerUtils.findParam(scope, attrs.minDate));

        ngModel.$validators.min = function (value) {
          if(!value && !attrs.required){return true;}
          //If we don't have a min / max value, then any value is valid.
          return minValid ? moment.isMoment(value) && (minDate.isSame(value) || minDate.isBefore(value)) : true;
        };
      }

      if (angular.isDefined(attrs.maxDate)) {
        setMax(datePickerUtils.findParam(scope, attrs.maxDate));

        ngModel.$validators.max = function (value) {
          if(!value && !attrs.required){return true;}
          return maxValid ? moment.isMoment(value) && (maxDate.isSame(value) || maxDate.isAfter(value)) : true;
        };
      }

      if (angular.isDefined(attrs.dateChange)) {
        dateChange = datePickerUtils.findFunction(scope, attrs.dateChange);
      }

      function getTemplate() {
        template = dateTimeConfig.template(attrs);
      }


      function updateInput(event) {
        event.stopPropagation();
        if (ngModel.$pristine) {
          ngModel.$dirty = true;
          ngModel.$pristine = false;
          element.removeClass(PRISTINE_CLASS).addClass(DIRTY_CLASS);
          if (parentForm) {
            parentForm.$setDirty();
          }
          ngModel.$render();
        }
      }

      function clear() {
        if (picker) {
          picker.remove();
          picker = null;
        }
        if (container) {
          container.remove();
          container = null;
        }
      }

      if (pickerID) {
        scope.$on('pickerUpdate', function (event, pickerIDs, data) {
          if (eventIsForPicker(pickerIDs, pickerID)) {
            if (picker) {
              //Need to handle situation where the data changed but the picker is currently open.
              //To handle this, we can create the inner picker with a random ID, then forward
              //any events received to it.
            } else {
              var validateRequired = false;
              if (angular.isDefined(data.minDate)) {
                setMin(data.minDate);
                validateRequired = true;
              }
              if (angular.isDefined(data.maxDate)) {
                setMax(data.maxDate);
                validateRequired = true;
              }

              if (angular.isDefined(data.minView)) {
                attrs.minView = data.minView;
              }
              if (angular.isDefined(data.maxView)) {
                attrs.maxView = data.maxView;
              }
              attrs.view = data.view || attrs.view;

              if (validateRequired) {
                ngModel.$validate();
              }
              if (angular.isDefined(data.format)) {
                format = attrs.format = data.format || dateTimeConfig.format;
                ngModel.$modelValue = -1; //Triggers formatters. This value will be discarded.
              }
              getTemplate();
            }
          }
        });
      }

      function getOffsetRect(elem) {
        var box = elem.getBoundingClientRect();
        var body = document.body;
        var docElem = document.documentElement;
        var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
        var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft;
        var clientTop = docElem.clientTop || body.clientTop || 0;
        var clientLeft = docElem.clientLeft || body.clientLeft || 0;
        var top  = box.top +  scrollTop - clientTop;
        var left = box.left + scrollLeft - clientLeft;
        return { top: Math.round(top), left: Math.round(left) };
      }

      function getAbsolutePosition() {
        var pickerHeight = picker[0].offsetHeight,
            pickerWidth = picker[0].offsetWidth;

        var pos = element[0].getBoundingClientRect(),
            pos2 = getOffsetRect(element[0]);
        // Support IE8
        var height = pos.height || element[0].offsetHeight,
            width = pos.width || element[0].offsetWidth;
        // bounds&sizes:
        var topScrollOffset  = window.scrollY,
            leftScrollOffset = window.scrollX,
            topOffset   = pos2.top,
            leftOffset  = pos2.left,
            screenHeight = window.innerHeight,
            screenWidth = window.innerWidth;

        var top = 0,
            left = leftOffset;
        // calculate top:
        if((screenHeight + topScrollOffset - topOffset - height - pickerHeight) < 0) {
          top = topOffset - pickerHeight;
        }
        else {
          top = topOffset + height;
        }
        // calculate left:
        if((screenWidth + leftScrollOffset - leftOffset - pickerWidth) < 0){
          left = leftOffset - (pickerWidth - width);
        }
        else{
          left = leftOffset;
        }

        return {
          top: top,
          left: left
        };
      }

      function showPicker() {
        if (picker) {
          return;
        }
        // create picker element
        picker = $compile(template)(scope);
        scope.$digest();

        //If the picker has already been shown before then we shouldn't be binding to events, as these events are already bound to in this scope.
        if (!shownOnce) {
          scope.$on('setDate', function (event, date, view) {
            updateInput(event);
            if (dateChange) {
              dateChange(attrs.ngModel, date);
            }
            if (dismiss && views[views.length - 1] === view) {
              clear();
            }
          });

          scope.$on('hidePicker', function () {
            $timeout(function(){
              element[0].blur();
            });
          });

          scope.$on('$destroy', clear);

          shownOnce = true;
        }


        // move picker below input element

        if (position === 'absolute') {
          picker.css({top: 0, left: 0, display: 'block', position: position, opacity: 0}); // hack to calculate picker size
          body.append(picker);
          var pos = getAbsolutePosition();
          picker.css({top: pos.top + 'px', left: pos.left + 'px', opacity: 1});
        } else {
          // relative
          container = angular.element('<div date-picker-wrapper></div>');
          element[0].parentElement.insertBefore(container[0], element[0]);
          container.append(picker);
          //          this approach doesn't work
          //          element.before(picker);
          picker.css({top: element[0].offsetHeight + 'px', display: 'block'});
        }
        picker.bind('mousedown', function (evt) {
          evt.preventDefault();
        });
      }

      angular.element($window).bind('resize', function() {
        if (picker) {
          var pos = getAbsolutePosition();
          picker.css({top: pos.top + 'px', left: pos.left + 'px', opacity: 1});
        }
      });
      element.bind('focus', showPicker);
      element.bind('blur', clear);
      getTemplate();
    }
  };
}]);
