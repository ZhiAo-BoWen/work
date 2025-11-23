(() => {
  const { statusOptions, today } = window.APP_CONFIG;

  // 周一到周日
  const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
  const salaryPerDay = 150;
  const defaultTotals = { total_workdays: 0, total_income: 0 };

  // 要显示的5个月：2025年10月、11月、12月，2026年1月、2月
  const monthsToShow = [
    { year: 2025, month: 10 },
    { year: 2025, month: 11 },
    { year: 2025, month: 12 },
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
  ];

  const elements = {
    calendarsContainer: document.getElementById("calendarsContainer"),
    normalCount: document.getElementById("normalCount"),
    leaveCount: document.getElementById("leaveCount"),
    totalSalary: document.getElementById("totalSalary"),
    totalWorkdays: document.getElementById("totalWorkdays"),
    totalIncome: document.getElementById("totalIncome"),
    popover: document.getElementById("statusPopover"),
    popoverDate: document.getElementById("popoverDate"),
    statusOptions: document.getElementById("statusOptions"),
    closePopover: document.getElementById("closePopover"),
  };

  const state = {
    today: new Date(today),
    records: {}, // 所有月份的记录
    activeDate: null,
    currentMonthForStats: null, // 当前用于统计的月份
  };

  function init() {
    bindEvents();
    renderStatusButtons();
    loadAllRecords();
  }

  function bindEvents() {
    elements.closePopover.addEventListener("click", hidePopover);
    elements.popover.addEventListener("click", (event) => {
      if (event.target === elements.popover) {
        hidePopover();
      }
    });
  }

  function renderStatusButtons() {
    // 添加正常状态选项
    Object.entries(statusOptions).forEach(([key, option]) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.type = "button";
      btn.style.backgroundColor = option.color;
      btn.dataset.status = key;
      btn.textContent = option.label;
      btn.addEventListener("click", () => {
        if (state.activeDate) {
          saveStatus(state.activeDate, key);
        }
      });
      elements.statusOptions.appendChild(btn);
    });

    // 添加"未设置"选项
    const unsetBtn = document.createElement("button");
    unsetBtn.className = "option-btn unset";
    unsetBtn.type = "button";
    unsetBtn.dataset.status = "unset";
    unsetBtn.textContent = "未设置";
    unsetBtn.addEventListener("click", () => {
      if (state.activeDate) {
        deleteStatus(state.activeDate);
      }
    });
    elements.statusOptions.appendChild(unsetBtn);
  }

  async function loadAllRecords() {
    // 加载所有5个月的数据
    const promises = monthsToShow.map(({ year, month }) => {
      const params = new URLSearchParams({
        year: year.toString(),
        month: month.toString(),
      });
      return fetch(`/api/records?${params.toString()}`)
        .then((response) => response.json())
        .then((data) => ({ year, month, data }))
        .catch((error) => {
          console.error(`加载 ${year}-${month} 数据失败:`, error);
          return { year, month, data: { records: {} } };
        });
    });

    const results = await Promise.all(promises);

    // 合并所有记录
    state.records = {};
    results.forEach(({ data }) => {
      if (data.records) {
        Object.assign(state.records, data.records);
      }
    });

    // 获取总计数据（从最后一个月的数据中）
    const lastMonthData = results[results.length - 1].data;
    state.totals = { ...defaultTotals, ...(lastMonthData.totals || {}) };

    renderAllCalendars();
    
    // 默认显示当前月的统计（今天所在的月份）
    const todayYear = state.today.getFullYear();
    const todayMonth = state.today.getMonth() + 1;
    updateSummaryForMonth(todayYear, todayMonth);
  }

  function renderAllCalendars() {
    elements.calendarsContainer.innerHTML = "";

    monthsToShow.forEach(({ year, month }) => {
      const calendarEl = createCalendar(year, month);
      elements.calendarsContainer.appendChild(calendarEl);
    });
  }

  function createCalendar(year, month) {
    const calendarEl = document.createElement("div");
    calendarEl.className = "calendar";
    calendarEl.dataset.year = year;
    calendarEl.dataset.month = month;

    // 日历标题
    const headerEl = document.createElement("div");
    headerEl.className = "calendar-header";
    headerEl.textContent = `${year} 年 ${month} 月`;
    calendarEl.appendChild(headerEl);

    // 日历网格
    const gridEl = document.createElement("div");
    gridEl.className = "calendar-grid";

    // 添加星期标题（周一到周日）
    weekdays.forEach((day) => {
      const weekdayEl = document.createElement("div");
      weekdayEl.className = "weekday";
      weekdayEl.textContent = day;
      gridEl.appendChild(weekdayEl);
    });

    // 计算第一天是星期几（转换为周一开始：0=周一，6=周日）
    const firstDay = new Date(year, month - 1, 1);
    let startWeekday = firstDay.getDay() - 1; // 转换为周一开始
    if (startWeekday < 0) startWeekday = 6; // 周日变成6

    // 添加空白占位
    for (let i = 0; i < startWeekday; i += 1) {
      const placeholder = document.createElement("div");
      placeholder.className = "day is-inactive";
      gridEl.appendChild(placeholder);
    }

    // 添加日期
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
        dayNumber
      ).padStart(2, "0")}`;
      const statusKey = state.records[dateStr];

      const dayEl = document.createElement("div");
      dayEl.className = "day";
      dayEl.dataset.date = dateStr;

      // 检查是否是今天
      const dateObj = new Date(year, month - 1, dayNumber);
      if (isToday(dateObj)) {
        dayEl.classList.add("is-today");
      }

      const numberEl = document.createElement("div");
      numberEl.className = "day-number";
      numberEl.textContent = dayNumber;

      const statusEl = document.createElement("div");
      statusEl.className = "day-status";

      if (statusKey && statusOptions[statusKey]) {
        applyStatusStyles(dayEl, statusEl, statusKey);
      } else {
        statusEl.textContent = "未设置";
        dayEl.style.backgroundColor = "#f0f0f0";
        dayEl.style.color = "#666";
      }

      dayEl.appendChild(numberEl);
      dayEl.appendChild(statusEl);

      dayEl.addEventListener("click", () => {
        openPopover(dateStr, year, month);
      });

      gridEl.appendChild(dayEl);
    }

    calendarEl.appendChild(gridEl);
    return calendarEl;
  }

  function applyStatusStyles(dayEl, statusEl, statusKey) {
    const option = statusOptions[statusKey];
    dayEl.style.backgroundColor = option.color;
    dayEl.style.color = "#fff";
    statusEl.textContent = option.label; // 显示完整文字
  }

  function isToday(dateObj) {
    return (
      dateObj.getFullYear() === state.today.getFullYear() &&
      dateObj.getMonth() === state.today.getMonth() &&
      dateObj.getDate() === state.today.getDate()
    );
  }

  function openPopover(dateStr, year, month) {
    state.activeDate = dateStr;
    state.currentMonthForStats = { year, month };
    elements.popoverDate.textContent = dateStr;
    elements.popover.hidden = false;
  }

  function hidePopover() {
    state.activeDate = null;
    elements.popover.hidden = true;
  }

  async function saveStatus(dateStr, statusKey) {
    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date: dateStr, status: statusKey }),
      });
      const payload = await response.json();

      if (!response.ok) {
        alert(payload.error || "保存失败");
        return;
      }

      // 更新本地状态
      state.records[dateStr] = statusKey;
      if (payload.totals) {
        state.totals = { ...defaultTotals, ...payload.totals };
      }

      // 更新UI
      updateDayCell(dateStr, statusKey);
      if (state.currentMonthForStats) {
        updateSummaryForMonth(
          state.currentMonthForStats.year,
          state.currentMonthForStats.month
        );
      }
      hidePopover();
    } catch (error) {
      console.error(error);
      alert("网络异常，保存失败");
    }
  }

  async function deleteStatus(dateStr) {
    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date: dateStr, status: "unset" }),
      });
      const payload = await response.json();

      if (!response.ok) {
        alert(payload.error || "删除失败");
        return;
      }

      // 删除本地状态
      delete state.records[dateStr];
      if (payload.totals) {
        state.totals = { ...defaultTotals, ...payload.totals };
      }

      // 更新UI
      updateDayCell(dateStr, null);
      if (state.currentMonthForStats) {
        updateSummaryForMonth(
          state.currentMonthForStats.year,
          state.currentMonthForStats.month
        );
      }
      hidePopover();
    } catch (error) {
      console.error(error);
      alert("网络异常，删除失败");
    }
  }

  function updateDayCell(dateStr, statusKey) {
    const dayEl = document.querySelector(`.day[data-date="${dateStr}"]`);
    if (!dayEl) return;

    const statusEl = dayEl.querySelector(".day-status");

    if (statusKey && statusOptions[statusKey]) {
      applyStatusStyles(dayEl, statusEl, statusKey);
    } else {
      dayEl.style.backgroundColor = "#f0f0f0";
      dayEl.style.color = "#666";
      statusEl.textContent = "未设置";
    }
  }

  function updateSummaryForMonth(year, month) {
    let normal = 0;
    let leave = 0;

    Object.entries(state.records).forEach(([dateStr, statusKey]) => {
      // 直接从日期字符串解析年月
      const [dateYear, dateMonth] = dateStr.split("-").map(Number);
      if (dateYear === year && dateMonth === month) {
        if (statusKey === "normal") normal += 1;
        if (statusKey === "leave") leave += 1;
      }
    });

    elements.normalCount.textContent = normal.toString();
    elements.leaveCount.textContent = leave.toString();
    elements.totalSalary.textContent = (normal * salaryPerDay).toString();
    updateTotals();
  }

  function updateTotals() {
    const { total_workdays = 0, total_income = 0 } = state.totals;
    elements.totalWorkdays.textContent = total_workdays.toString();
    elements.totalIncome.textContent = total_income.toString();
  }

  init();
})();
