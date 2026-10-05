/**
 * tb-calendar.js - High performance, drill-down custom Date Picker for TokenBridge
 * Supports: Day View -> Month View -> Decade (Year) View
 * Full Dark & Light theme synchronization, ultra-smooth fluid micro-transitions.
 */

(function (global) {
  'use strict';

  var MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  var MONTH_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  var DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatDate(y, m, d) {
    return y + '-' + pad(m + 1) + '-' + pad(d);
  }

  function parseDate(str) {
    if (!str || typeof str !== 'string') return null;
    var parts = str.trim().split('-');
    if (parts.length !== 3) return null;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return new Date(y, m, d);
  }

  function TBCalendar(inputElement, options) {
    this.input = inputElement;
    this.options = options || {};
    this.view = 'days'; // 'days' | 'months' | 'years'
    this.activeDate = new Date();
    this.selectedDate = null;
    this.isOpen = false;

    this.init();
  }

  TBCalendar.prototype.init = function () {
    var self = this;
    var initVal = parseDate(this.input.value);
    if (initVal && !isNaN(initVal.getTime())) {
      this.selectedDate = initVal;
      this.activeDate = new Date(initVal.getTime());
    } else {
      this.activeDate = new Date();
    }

    // Wrap input or assign positioning
    this.input.setAttribute('autocomplete', 'off');
    this.input.setAttribute('placeholder', 'YYYY-MM-DD');

    // Create dropdown popup
    this.popup = document.createElement('div');
    this.popup.className = 'tb-calendar-popup';
    this.popup.setAttribute('role', 'dialog');
    this.popup.setAttribute('aria-label', 'Calendar Date Picker');
    document.body.appendChild(this.popup);

    // Event listeners
    this.input.addEventListener('click', function (e) {
      e.stopPropagation();
      self.open();
    });

    this.input.addEventListener('focus', function () {
      self.open();
    });

    this.input.addEventListener('change', function () {
      var parsed = parseDate(self.input.value);
      if (parsed) {
        self.selectedDate = parsed;
        self.activeDate = new Date(parsed.getTime());
        self.render();
      }
    });

    // Close on outside click
    document.addEventListener('mousedown', function (e) {
      if (self.isOpen && !self.popup.contains(e.target) && e.target !== self.input) {
        self.close();
      }
    });

    // Reposition on window resize or scroll
    window.addEventListener('resize', function () {
      if (self.isOpen) self.position();
    }, { passive: true });

    window.addEventListener('scroll', function () {
      if (self.isOpen) self.position();
    }, { passive: true });
  };

  TBCalendar.prototype.position = function () {
    var rect = this.input.getBoundingClientRect();
    var popupWidth = 280;
    var popupHeight = 310;
    
    var top = rect.bottom + window.scrollY + 6;
    var left = rect.left + window.scrollX;

    // Flip to top if overflowing window bottom
    if (rect.bottom + popupHeight > window.innerHeight && rect.top > popupHeight) {
      top = rect.top + window.scrollY - popupHeight - 6;
    }

    // Keep within horizontal bounds
    if (left + popupWidth > window.innerWidth - 12) {
      left = window.innerWidth - popupWidth - 12;
    }
    if (left < 12) left = 12;

    this.popup.style.top = top + 'px';
    this.popup.style.left = left + 'px';
  };

  TBCalendar.prototype.open = function () {
    if (this.isOpen) return;
    this.isOpen = true;
    var parsed = parseDate(this.input.value);
    if (parsed) {
      this.selectedDate = parsed;
      this.activeDate = new Date(parsed.getTime());
    }
    this.view = 'days';
    this.render();
    this.position();
    this.popup.classList.add('open');
  };

  TBCalendar.prototype.close = function () {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.popup.classList.remove('open');
  };

  TBCalendar.prototype.render = function () {
    var self = this;
    this.popup.innerHTML = '';

    // Header container
    var header = document.createElement('div');
    header.className = 'tb-cal-header';

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'tb-cal-nav tb-cal-prev';
    prevBtn.innerHTML = '&#9664;';
    prevBtn.title = 'Previous';

    var titleBtn = document.createElement('button');
    titleBtn.type = 'button';
    titleBtn.className = 'tb-cal-title';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'tb-cal-nav tb-cal-next';
    nextBtn.innerHTML = '&#9654;';
    nextBtn.title = 'Next';

    var curYear = this.activeDate.getFullYear();
    var curMonth = this.activeDate.getMonth();

    if (this.view === 'days') {
      titleBtn.textContent = MONTH_NAMES[curMonth] + ', ' + curYear;
      titleBtn.onclick = function (e) {
        e.stopPropagation();
        self.view = 'months';
        self.render();
      };

      prevBtn.onclick = function (e) {
        e.stopPropagation();
        self.activeDate.setMonth(self.activeDate.getMonth() - 1);
        self.render();
      };

      nextBtn.onclick = function (e) {
        e.stopPropagation();
        self.activeDate.setMonth(self.activeDate.getMonth() + 1);
        self.render();
      };
    } else if (this.view === 'months') {
      titleBtn.textContent = String(curYear);
      titleBtn.onclick = function (e) {
        e.stopPropagation();
        self.view = 'years';
        self.render();
      };

      prevBtn.onclick = function (e) {
        e.stopPropagation();
        self.activeDate.setFullYear(self.activeDate.getFullYear() - 1);
        self.render();
      };

      nextBtn.onclick = function (e) {
        e.stopPropagation();
        self.activeDate.setFullYear(self.activeDate.getFullYear() + 1);
        self.render();
      };
    } else if (this.view === 'years') {
      var decadeStart = Math.floor(curYear / 10) * 10;
      var decadeEnd = decadeStart + 9;
      titleBtn.textContent = decadeStart + '–' + decadeEnd;
      titleBtn.style.cursor = 'default';

      prevBtn.onclick = function (e) {
        e.stopPropagation();
        self.activeDate.setFullYear(self.activeDate.getFullYear() - 10);
        self.render();
      };

      nextBtn.onclick = function (e) {
        e.stopPropagation();
        self.activeDate.setFullYear(self.activeDate.getFullYear() + 10);
        self.render();
      };
    }

    header.appendChild(prevBtn);
    header.appendChild(titleBtn);
    header.appendChild(nextBtn);
    this.popup.appendChild(header);

    // Body content
    var body = document.createElement('div');
    body.className = 'tb-cal-body tb-cal-view-' + this.view;

    if (this.view === 'days') {
      this.renderDays(body);
    } else if (this.view === 'months') {
      this.renderMonths(body);
    } else if (this.view === 'years') {
      this.renderYears(body);
    }

    this.popup.appendChild(body);

    // Footer - "Today: [Month Day, Year]"
    var footer = document.createElement('div');
    footer.className = 'tb-cal-footer';
    var today = new Date();
    var todayFormatted = MONTH_NAMES[today.getMonth()] + ' ' + today.getDate() + ', ' + today.getFullYear();
    footer.innerHTML = 'Today: <span>' + todayFormatted + '</span>';
    footer.onclick = function (e) {
      e.stopPropagation();
      self.selectDate(today.getFullYear(), today.getMonth(), today.getDate());
    };
    this.popup.appendChild(footer);
  };

  TBCalendar.prototype.renderDays = function (container) {
    var self = this;
    var year = this.activeDate.getFullYear();
    var month = this.activeDate.getMonth();

    // Day headers row
    var headRow = document.createElement('div');
    headRow.className = 'tb-cal-grid-days-header';
    for (var h = 0; h < 7; h++) {
      var th = document.createElement('div');
      th.className = 'tb-cal-th';
      th.textContent = DAY_HEADERS[h];
      headRow.appendChild(th);
    }
    container.appendChild(headRow);

    var grid = document.createElement('div');
    grid.className = 'tb-cal-grid-days';

    var firstDayOfMonth = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var daysInPrevMonth = new Date(year, month, 0).getDate();

    var today = new Date();
    var isCurrentMonthToday = (today.getFullYear() === year && today.getMonth() === month);

    // Previous month filler days
    for (var p = firstDayOfMonth - 1; p >= 0; p--) {
      var pDay = daysInPrevMonth - p;
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'tb-cal-cell tb-cal-day tb-cal-other-month';
      cell.textContent = pDay;
      (function (d) {
        cell.onclick = function (e) {
          e.stopPropagation();
          var prevM = month - 1;
          var prevY = year;
          if (prevM < 0) { prevM = 11; prevY--; }
          self.selectDate(prevY, prevM, d);
        };
      })(pDay);
      grid.appendChild(cell);
    }

    // Days in current month
    for (var d = 1; d <= daysInMonth; d++) {
      var dayCell = document.createElement('button');
      dayCell.type = 'button';
      dayCell.className = 'tb-cal-cell tb-cal-day';
      dayCell.textContent = d;

      if (isCurrentMonthToday && today.getDate() === d) {
        dayCell.classList.add('today');
      }

      if (self.selectedDate &&
          self.selectedDate.getFullYear() === year &&
          self.selectedDate.getMonth() === month &&
          self.selectedDate.getDate() === d) {
        dayCell.classList.add('selected');
      }

      (function (dayNum) {
        dayCell.onclick = function (e) {
          e.stopPropagation();
          self.selectDate(year, month, dayNum);
        };
      })(d);

      grid.appendChild(dayCell);
    }

    // Next month filler days (to make 42 or 35 cells)
    var totalCells = firstDayOfMonth + daysInMonth;
    var remaining = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
    for (var n = 1; n <= remaining; n++) {
      var nCell = document.createElement('button');
      nCell.type = 'button';
      nCell.className = 'tb-cal-cell tb-cal-day tb-cal-other-month';
      nCell.textContent = n;
      (function (nextD) {
        nCell.onclick = function (e) {
          e.stopPropagation();
          var nextM = month + 1;
          var nextY = year;
          if (nextM > 11) { nextM = 0; nextY++; }
          self.selectDate(nextY, nextM, nextD);
        };
      })(n);
      grid.appendChild(nCell);
    }

    container.appendChild(grid);
  };

  TBCalendar.prototype.renderMonths = function (container) {
    var self = this;
    var year = this.activeDate.getFullYear();
    var curMonth = this.activeDate.getMonth();
    var today = new Date();

    var grid = document.createElement('div');
    grid.className = 'tb-cal-grid-3x4';

    for (var m = 0; m < 12; m++) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'tb-cal-cell tb-cal-month';
      cell.textContent = MONTH_SHORT[m];

      if (today.getFullYear() === year && today.getMonth() === m) {
        cell.classList.add('today');
      }

      if (self.selectedDate &&
          self.selectedDate.getFullYear() === year &&
          self.selectedDate.getMonth() === m) {
        cell.classList.add('selected');
      }

      (function (monthIndex) {
        cell.onclick = function (e) {
          e.stopPropagation();
          self.activeDate.setMonth(monthIndex);
          self.view = 'days';
          self.render();
        };
      })(m);

      grid.appendChild(cell);
    }

    container.appendChild(grid);
  };

  TBCalendar.prototype.renderYears = function (container) {
    var self = this;
    var curYear = this.activeDate.getFullYear();
    var decadeStart = Math.floor(curYear / 10) * 10;
    var todayYear = new Date().getFullYear();

    var grid = document.createElement('div');
    grid.className = 'tb-cal-grid-3x4';

    // 12 year items: 1 prev decade, 10 decade years, 1 next decade
    for (var y = decadeStart - 1; y <= decadeStart + 10; y++) {
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'tb-cal-cell tb-cal-year';
      cell.textContent = y;

      if (y < decadeStart || y > decadeStart + 9) {
        cell.classList.add('tb-cal-other-month');
      }

      if (todayYear === y) {
        cell.classList.add('today');
      }

      if (self.selectedDate && self.selectedDate.getFullYear() === y) {
        cell.classList.add('selected');
      }

      (function (targetYear) {
        cell.onclick = function (e) {
          e.stopPropagation();
          self.activeDate.setFullYear(targetYear);
          self.view = 'months';
          self.render();
        };
      })(y);

      grid.appendChild(cell);
    }

    container.appendChild(grid);
  };

  TBCalendar.prototype.selectDate = function (y, m, d) {
    this.selectedDate = new Date(y, m, d);
    var formatted = formatDate(y, m, d);
    this.input.value = formatted;

    // Trigger input and change events so external autoCalculateAge handlers fire seamlessly
    var eventInput = new Event('input', { bubbles: true });
    var eventChange = new Event('change', { bubbles: true });
    this.input.dispatchEvent(eventInput);
    this.input.dispatchEvent(eventChange);

    this.close();
  };

  // Factory initializer
  global.initTBCalendars = function () {
    var inputs = document.querySelectorAll('input[type="date"], input[data-tb-datepicker]');
    inputs.forEach(function (input) {
      if (input._tbCal) return;
      // Change type to text so browser native picker does not pop up
      input.type = 'text';
      input.setAttribute('data-tb-datepicker', 'true');
      input._tbCal = new TBCalendar(input);
    });
  };

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', global.initTBCalendars);
  } else {
    global.initTBCalendars();
  }

})(window);
