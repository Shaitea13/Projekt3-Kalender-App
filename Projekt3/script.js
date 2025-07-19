// Modern Calendar App with Enhanced Notifications
class CalendarApp {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.currentView = 'month';
        this.events = {};
        this.reminders = {};
        this.notificationSettings = {
            enabled: false,
            dailyReminder: false,
            soundEnabled: false
        };
        this.monthNames = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
        
        this.init();
    }

    init() {
        this.loadData();
        this.checkUpcomingEvents();
        this.setupEventListeners();
        this.renderCalendar();
        this.startReminderCheck();
        this.updateNotificationBadge();
    }

    loadData() {
        try {
            // Events laden
            const storedEvents = localStorage.getItem('calendarEvents');
            if (storedEvents) {
                this.events = JSON.parse(storedEvents);
            }
            
            // Benachrichtigungseinstellungen laden
            const storedSettings = localStorage.getItem('notificationSettings');
            if (storedSettings) {
                this.notificationSettings = JSON.parse(storedSettings);
            }
            
            // Erinnerungen laden
            const storedReminders = localStorage.getItem('calendarReminders');
            if (storedReminders) {
                this.reminders = JSON.parse(storedReminders);
            }
        } catch (error) {
            console.warn('Fehler beim Laden der Daten:', error);
        }
    }

    saveData() {
        try {
            localStorage.setItem('calendarEvents', JSON.stringify(this.events));
            localStorage.setItem('notificationSettings', JSON.stringify(this.notificationSettings));
            localStorage.setItem('calendarReminders', JSON.stringify(this.reminders));
        } catch (error) {
            console.warn('Fehler beim Speichern der Daten:', error);
        }
    }

    requestNotificationPermission() {
        // Nur wenn explizit vom Benutzer aktiviert
        if (this.notificationSettings.enabled && "Notification" in window && Notification.permission === "default") {
            Notification.requestPermission().then(permission => {
                if (permission !== "granted") {
                    this.notificationSettings.enabled = false;
                    this.saveData();
                    // Update checkbox
                    const checkbox = document.getElementById('notificationEnabled');
                    if (checkbox) checkbox.checked = false;
                }
            });
        }
    }

    formatReminderTime(minutes) {
        if (minutes === 0) return 'Zur Ereigniszeit';
        
        const days = Math.floor(minutes / 1440);
        const hours = Math.floor((minutes % 1440) / 60);
        const mins = minutes % 60;
        
        let parts = [];
        if (days > 0) parts.push(`${days} Tag${days !== 1 ? 'e' : ''}`);
        if (hours > 0) parts.push(`${hours} Stunde${hours !== 1 ? 'n' : ''}`);
        if (mins > 0) parts.push(`${mins} Minute${mins !== 1 ? 'n' : ''}`);
        
        return parts.join(', ') + ' vorher';
    }

    startReminderCheck() {
        // Prüfe alle 60 Sekunden auf anstehende Erinnerungen
        setInterval(() => {
            this.checkReminders();
        }, 60000);
        
        // Sofortige Überprüfung
        this.checkReminders();
    }

    checkReminders() {
        const now = new Date();
        const todayKey = this.getDateKey(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEvents = this.events[todayKey] || [];
        
        todayEvents.forEach(event => {
            if (event.reminder !== undefined && event.reminder !== null) {
                const eventTime = new Date();
                const [hours, minutes] = event.time.split(':');
                eventTime.setHours(parseInt(hours), parseInt(minutes), 0);
                
                // Berechne Erinnerungszeit
                const reminderTime = new Date(eventTime.getTime() - event.reminder * 60000);
                
                // Prüfe ob Erinnerung fällig ist
                if (now >= reminderTime && now < eventTime) {
                    const reminderKey = `${event.id}_${todayKey}`;
                    if (!this.reminders[reminderKey]) {
                        this.sendReminder(event);
                        this.reminders[reminderKey] = true;
                        this.saveData();
                    }
                }
            }
        });
        
        // Tägliche Zusammenfassung um 8:00 Uhr
        if (this.notificationSettings.dailyReminder && now.getHours() === 8 && now.getMinutes() === 0) {
            const dailyKey = `daily_${todayKey}`;
            if (!this.reminders[dailyKey]) {
                this.sendDailySummary();
                this.reminders[dailyKey] = true;
                this.saveData();
            }
        }
    }

    sendReminder(event) {
        const message = event.reminder === 0 
            ? `Termin jetzt: ${event.title}`
            : `Erinnerung: ${event.title} ${this.formatReminderTime(event.reminder)}`;
        
        this.showNotificationToast('📅 Terminerinnerung', message, event.color);
        
        if (this.notificationSettings.enabled && Notification.permission === "granted") {
            this.sendBrowserNotification('📅 Terminerinnerung', message);
        }
        
        if (this.notificationSettings.soundEnabled) {
            this.playNotificationSound();
        }
    }

    sendDailySummary() {
        const today = new Date();
        const todayKey = this.getDateKey(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEvents = this.events[todayKey] || [];
        
        if (todayEvents.length > 0) {
            const message = `Du hast heute ${todayEvents.length} Termin${todayEvents.length > 1 ? 'e' : ''}`;
            this.showNotificationToast('☀️ Guten Morgen!', message);
            
            if (this.notificationSettings.enabled) {
                this.sendBrowserNotification('☀️ Tagesübersicht', message);
            }
        }
    }

    showNotificationToast(title, message, color = 'var(--primary-color)') {
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.style.borderColor = color;
        
        toast.innerHTML = `
            <h3 style="margin-bottom: 8px; color: ${color};">${title}</h3>
            <p style="margin-bottom: 12px;">${message}</p>
            <button class="close-toast" style="
                background: ${color};
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            ">OK</button>
        `;
        
        document.body.appendChild(toast);
        
        const closeBtn = toast.querySelector('.close-toast');
        closeBtn.addEventListener('click', () => {
            toast.style.animation = 'slideOutRight 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        });
        
        // Auto-close nach 5 Sekunden
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOutRight 0.5s ease';
                setTimeout(() => toast.remove(), 500);
            }
        }, 5000);
    }

    sendBrowserNotification(title, body) {
        if ("Notification" in window && Notification.permission === "granted") {
            const notification = new Notification(title, {
                body: body,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234A90E2"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>',
                badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234A90E2"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>'
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }
    }

    playNotificationSound() {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCA');
        audio.play().catch(e => console.log('Audio playback failed:', e));
    }

    checkUpcomingEvents() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayKey = this.getDateKey(today.getFullYear(), today.getMonth(), today.getDate());
        const tomorrowKey = this.getDateKey(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        
        const todayEvents = this.events[todayKey] || [];
        const tomorrowEvents = this.events[tomorrowKey] || [];
        
        if (todayEvents.length > 0 || tomorrowEvents.length > 0) {
            this.showUpcomingNotification(todayEvents, tomorrowEvents);
        }
    }

    showUpcomingNotification(todayEvents, tomorrowEvents) {
        const notification = document.createElement('div');
        notification.className = 'notification-toast';
        
        let notificationHTML = '<h3 style="margin-bottom: 12px; color: var(--primary-color);">📅 Anstehende Termine</h3>';
        
        if (todayEvents.length > 0) {
            notificationHTML += '<div style="margin-bottom: 12px;"><strong style="color: var(--accent-color);">Heute:</strong>';
            todayEvents.forEach(event => {
                notificationHTML += `
                    <div style="margin: 8px 0; padding: 8px; background: var(--surface-light); border-radius: 8px; border-left: 3px solid ${event.color};">
                        <div style="font-weight: 600;">${event.time} - ${event.title}</div>
                        ${event.description ? `<div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">${event.description}</div>` : ''}
                    </div>
                `;
            });
            notificationHTML += '</div>';
        }
        
        if (tomorrowEvents.length > 0) {
            notificationHTML += '<div><strong style="color: var(--secondary-color);">Morgen:</strong>';
            tomorrowEvents.forEach(event => {
                notificationHTML += `
                    <div style="margin: 8px 0; padding: 8px; background: var(--surface-light); border-radius: 8px; border-left: 3px solid ${event.color};">
                        <div style="font-weight: 600;">${event.time} - ${event.title}</div>
                        ${event.description ? `<div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">${event.description}</div>` : ''}
                    </div>
                `;
            });
            notificationHTML += '</div>';
        }
        
        notificationHTML += `
            <button class="close-toast" style="
                margin-top: 16px;
                width: 100%;
                padding: 10px;
                background: var(--primary-color);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            ">Verstanden</button>
        `;
        
        notification.innerHTML = notificationHTML;
        document.body.appendChild(notification);
        
        notification.querySelector('.close-toast').addEventListener('click', () => {
            notification.style.animation = 'slideOutRight 0.5s ease';
            setTimeout(() => notification.remove(), 500);
        });
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.5s ease';
                setTimeout(() => notification.remove(), 500);
            }
        }, 10000);
    }

    updateNotificationBadge() {
        const badge = document.getElementById('notificationBadge');
        if (!badge) return;
        
        const today = new Date();
        const todayKey = this.getDateKey(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEvents = this.events[todayKey] || [];
        
        let upcomingCount = 0;
        todayEvents.forEach(event => {
            if (event.time) {
                const [hours, minutes] = event.time.split(':');
                const eventTime = new Date();
                eventTime.setHours(parseInt(hours), parseInt(minutes), 0);
                if (eventTime > today) {
                    upcomingCount++;
                }
            }
        });
        
        if (upcomingCount > 0) {
            badge.textContent = upcomingCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('prevMonth')?.addEventListener('click', () => this.navigate(-1));
        document.getElementById('nextMonth')?.addEventListener('click', () => this.navigate(1));
        document.getElementById('todayBtn')?.addEventListener('click', () => this.goToToday());
        
        // View Selector
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.changeView(e));
        });
        
        // Event Modal
        document.getElementById('closeModal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('eventForm')?.addEventListener('submit', (e) => this.saveEvent(e));
        
        // Reminder Toggle
        document.getElementById('enableReminder')?.addEventListener('change', (e) => {
            const reminderOptions = document.getElementById('reminderOptions');
            if (reminderOptions) {
                reminderOptions.style.display = e.target.checked ? 'block' : 'none';
            }
        });
        
        // Notification Button
        document.getElementById('notificationBtn')?.addEventListener('click', () => this.openNotificationSettings());
        
        // Notification Modal
        document.getElementById('closeNotificationModal')?.addEventListener('click', () => this.closeNotificationModal());
        
        // Notification Settings
        document.getElementById('notificationEnabled')?.addEventListener('change', (e) => {
            this.notificationSettings.enabled = e.target.checked;
            if (e.target.checked) {
                // Nur Berechtigung anfragen wenn aktiviert
                this.requestNotificationPermission();
            }
            this.saveData();
        });
        
        document.getElementById('dailyReminder')?.addEventListener('change', (e) => {
            this.notificationSettings.dailyReminder = e.target.checked;
            this.saveData();
        });
        
        document.getElementById('soundEnabled')?.addEventListener('change', (e) => {
            this.notificationSettings.soundEnabled = e.target.checked;
            this.saveData();
        });
        
        // Close modals on outside click
        window.addEventListener('click', (e) => {
            const eventModal = document.getElementById('eventModal');
            const notificationModal = document.getElementById('notificationModal');
            if (e.target === eventModal) {
                this.closeModal();
            }
            if (e.target === notificationModal) {
                this.closeNotificationModal();
            }
        });
    }

    navigate(direction) {
        switch(this.currentView) {
            case 'month':
                this.currentDate.setMonth(this.currentDate.getMonth() + direction);
                this.renderCalendar();
                break;
            case 'week':
                this.currentDate.setDate(this.currentDate.getDate() + (7 * direction));
                this.renderWeekView();
                break;
            case 'day':
                this.currentDate.setDate(this.currentDate.getDate() + direction);
                this.renderDayView();
                break;
            case 'year':
                this.currentDate.setFullYear(this.currentDate.getFullYear() + direction);
                this.renderYearView();
                break;
        }
        this.updateNotificationBadge();
    }

    renderCalendar() {
        this.currentView = 'month';
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const monthElement = document.getElementById('currentMonth');
        const yearElement = document.getElementById('currentYear');
        
        if (monthElement) monthElement.textContent = this.monthNames[month];
        if (yearElement) yearElement.textContent = year;
        
        const weekdaysHeader = document.getElementById('weekdaysHeader');
        if (weekdaysHeader) weekdaysHeader.classList.remove('hidden');
        
        const daysContainer = document.getElementById('calendarDays');
        if (!daysContainer) return;
        
        daysContainer.innerHTML = '';
        daysContainer.style.display = 'grid';
        daysContainer.style.gridTemplateColumns = 'repeat(7, 1fr)';
        daysContainer.style.gap = '8px';
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        
        const startDay = firstDay === 0 ? 6 : firstDay - 1;
        
        for (let i = startDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            this.createDayElement(day, month - 1, year, true);
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            this.createDayElement(day, month, year, false);
        }
        
        const totalDays = startDay + daysInMonth;
        const remainingDays = totalDays % 7 === 0 ? 0 : 7 - (totalDays % 7);
        for (let day = 1; day <= remainingDays; day++) {
            this.createDayElement(day, month + 1, year, true);
        }
    }

    createDayElement(day, month, year, isOtherMonth) {
        const dayElement = document.createElement('div');
        dayElement.className = 'day';
        
        if (isOtherMonth) {
            dayElement.classList.add('other-month');
        }
        
        const today = new Date();
        const isToday = day === today.getDate() && 
                       month === today.getMonth() && 
                       year === today.getFullYear();
        
        if (isToday && !isOtherMonth) {
            dayElement.classList.add('today');
        }
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayElement.appendChild(dayNumber);
        
        const dateKey = this.getDateKey(year, month, day);
        const dayEvents = this.events[dateKey] || [];
        
        if (dayEvents.length > 0) {
            const eventDots = document.createElement('div');
            eventDots.className = 'event-dots';
            
            dayEvents.slice(0, 3).forEach(event => {
                const dot = document.createElement('div');
                dot.className = 'event-dot';
                dot.style.backgroundColor = event.color;
                eventDots.appendChild(dot);
            });
            
            dayElement.appendChild(eventDots);
        }
        
        dayElement.addEventListener('click', () => {
            if (!isOtherMonth) {
                this.selectDate(year, month, day);
            }
        });
        
        const container = document.getElementById('calendarDays');
        if (container) {
            container.appendChild(dayElement);
        }
    }

    renderWeekView() {
        this.currentView = 'week';
        
        const weekdaysHeader = document.getElementById('weekdaysHeader');
        if (weekdaysHeader) weekdaysHeader.classList.add('hidden');
        
        const daysContainer = document.getElementById('calendarDays');
        if (!daysContainer) return;
        
        daysContainer.innerHTML = '';
        daysContainer.style.display = 'grid';
        daysContainer.style.gridTemplateColumns = 'repeat(8, 1fr)';
        daysContainer.style.gap = '4px';
        
        const currentDay = this.currentDate.getDay();
        const startOfWeek = new Date(this.currentDate);
        startOfWeek.setDate(this.currentDate.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
        
        const monthElement = document.getElementById('currentMonth');
        if (monthElement) monthElement.textContent = 'Wochenansicht';
        const yearElement = document.getElementById('currentYear');
        if (yearElement) yearElement.textContent = `${startOfWeek.toLocaleDateString('de-DE')} - ${new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE')}`;
        
        const emptyCell = document.createElement('div');
        emptyCell.style.cssText = 'padding: 10px; font-weight: bold;';
        daysContainer.appendChild(emptyCell);
        
        const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        for (let i = 0; i < 7; i++) {
            const dayHeader = document.createElement('div');
            const currentDate = new Date(startOfWeek.getTime() + i * 24 * 60 * 60 * 1000);
            dayHeader.style.cssText = 'padding: 10px; text-align: center; font-weight: bold; background: var(--surface); border-radius: 8px;';
            dayHeader.textContent = `${weekDays[i]} ${currentDate.getDate()}.${currentDate.getMonth() + 1}`;
            daysContainer.appendChild(dayHeader);
        }
        
        for (let hour = 0; hour < 24; hour++) {
            const timeLabel = document.createElement('div');
            timeLabel.style.cssText = 'padding: 10px; font-weight: bold; color: var(--text-secondary);';
            timeLabel.textContent = `${hour}:00`;
            daysContainer.appendChild(timeLabel);
            
            for (let day = 0; day < 7; day++) {
                const slot = document.createElement('div');
                slot.className = 'time-slot';
                slot.style.cssText = 'border: 1px solid var(--border-color); padding: 10px; min-height: 60px; background: var(--surface); border-radius: 4px;';
                
                const currentDate = new Date(startOfWeek.getTime() + day * 24 * 60 * 60 * 1000);
                const dateKey = this.getDateKey(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
                const events = this.events[dateKey] || [];
                
                events.forEach(event => {
                    if (event.time && event.time.startsWith(hour.toString().padStart(2, '0'))) {
                        const eventEl = document.createElement('div');
                        eventEl.style.cssText = `background: ${event.color}; padding: 4px; border-radius: 4px; margin: 2px 0; font-size: 12px; cursor: pointer;`;
                        eventEl.textContent = event.title;
                        eventEl.addEventListener('click', () => {
                            this.selectDate(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
                        });
                        slot.appendChild(eventEl);
                    }
                });
                
                daysContainer.appendChild(slot);
            }
        }
    }

    renderDayView() {
        this.currentView = 'day';
        
        const weekdaysHeader = document.getElementById('weekdaysHeader');
        if (weekdaysHeader) weekdaysHeader.classList.add('hidden');
        
        const daysContainer = document.getElementById('calendarDays');
        if (!daysContainer) return;
        
        daysContainer.innerHTML = '';
        daysContainer.style.display = 'block';
        daysContainer.style.gridTemplateColumns = 'none';
        
        const monthElement = document.getElementById('currentMonth');
        if (monthElement) monthElement.textContent = this.currentDate.toLocaleDateString('de-DE', { weekday: 'long' });
        const yearElement = document.getElementById('currentYear');
        if (yearElement) yearElement.textContent = this.currentDate.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
        
        for (let hour = 0; hour < 24; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'hour-slot';
            timeSlot.style.cssText = 'display: flex; border-bottom: 1px solid var(--border-color); padding: 20px; min-height: 80px; background: var(--surface); margin: 8px 0; border-radius: 8px;';
            
            const timeLabel = document.createElement('div');
            timeLabel.style.cssText = 'width: 80px; font-weight: bold; color: var(--text-secondary);';
            timeLabel.textContent = `${hour}:00`;
            
            const eventSpace = document.createElement('div');
            eventSpace.style.cssText = 'flex: 1; padding-left: 20px;';
            
            const dateKey = this.getDateKey(this.currentDate.getFullYear(), this.currentDate.getMonth(), this.currentDate.getDate());
            const events = this.events[dateKey] || [];
            
            events.forEach(event => {
                if (event.time && event.time.startsWith(hour.toString().padStart(2, '0'))) {
                    const eventEl = document.createElement('div');
                    eventEl.style.cssText = `background: ${event.color}; padding: 8px; border-radius: 4px; margin: 4px 0; cursor: pointer;`;
                    eventEl.innerHTML = `
                        <div style="font-weight: 600;">${event.time} - ${event.title}</div>
                        ${event.description ? `<div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">${event.description}</div>` : ''}
                        ${event.reminder !== undefined ? `<div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">🔔 Erinnerung ${this.formatReminderTime(event.reminder)}</div>` : ''}
                    `;
                    eventEl.addEventListener('click', () => {
                        this.selectDate(this.currentDate.getFullYear(), this.currentDate.getMonth(), this.currentDate.getDate());
                    });
                    eventSpace.appendChild(eventEl);
                }
            });
            
            timeSlot.appendChild(timeLabel);
            timeSlot.appendChild(eventSpace);
            daysContainer.appendChild(timeSlot);
        }
    }

    renderYearView() {
        this.currentView = 'year';
        
        const weekdaysHeader = document.getElementById('weekdaysHeader');
        if (weekdaysHeader) weekdaysHeader.classList.add('hidden');
        
        const daysContainer = document.getElementById('calendarDays');
        if (!daysContainer) return;
        
        daysContainer.innerHTML = '';
        daysContainer.style.display = 'grid';
        daysContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
        daysContainer.style.gap = '16px';
        
        const year = this.currentDate.getFullYear();
        
        const monthElement = document.getElementById('currentMonth');
        if (monthElement) monthElement.textContent = 'Jahresübersicht';
        const yearElement = document.getElementById('currentYear');
        if (yearElement) yearElement.textContent = year;
        
        for (let month = 0; month < 12; month++) {
            const monthContainer = document.createElement('div');
            monthContainer.className = 'mini-month';
            
            const monthHeader = document.createElement('div');
            monthHeader.style.cssText = 'text-align: center; font-weight: bold; margin-bottom: 8px; color: var(--primary-color);';
            monthHeader.textContent = this.monthNames[month];
            monthContainer.appendChild(monthHeader);
            
            const miniGrid = document.createElement('div');
            miniGrid.style.cssText = 'display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; font-size: 10px;';
            
            ['M', 'D', 'M', 'D', 'F', 'S', 'S'].forEach(day => {
                const dayHeader = document.createElement('div');
                dayHeader.style.cssText = 'text-align: center; color: var(--text-secondary); font-weight: bold;';
                dayHeader.textContent = day;
                miniGrid.appendChild(dayHeader);
            });
            
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const startDay = firstDay === 0 ? 6 : firstDay - 1;
            
            for (let i = 0; i < startDay; i++) {
                miniGrid.appendChild(document.createElement('div'));
            }
            
            for (let day = 1; day <= daysInMonth; day++) {
                const dayEl = document.createElement('div');
                dayEl.style.cssText = 'text-align: center; padding: 2px; border-radius: 2px; cursor: pointer;';
                dayEl.textContent = day;
                
                const today = new Date();
                if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
                    dayEl.style.background = 'var(--primary-color)';
                    dayEl.style.color = 'white';
                    dayEl.style.fontWeight = 'bold';
                }
                
                const dateKey = this.getDateKey(year, month, day);
                if (this.events[dateKey] && this.events[dateKey].length > 0) {
                    dayEl.style.fontWeight = 'bold';
                    dayEl.style.color = 'var(--accent-color)';
                }
                
                miniGrid.appendChild(dayEl);
            }
            
            monthContainer.appendChild(miniGrid);
            
            monthContainer.addEventListener('click', () => {
                this.currentDate = new Date(year, month, 1);
                document.querySelector('.view-btn[data-view="month"]').click();
            });
            
            daysContainer.appendChild(monthContainer);
        }
    }

    changeView(e) {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        e.target.classList.add('active');
        
        const view = e.target.dataset.view;
        
        switch(view) {
            case 'month':
                this.renderCalendar();
                break;
            case 'week':
                this.renderWeekView();
                break;
            case 'day':
                this.renderDayView();
                break;
            case 'year':
                this.renderYearView();
                break;
        }
    }

    selectDate(year, month, day) {
        document.querySelectorAll('.day.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        const days = document.querySelectorAll('.day:not(.other-month)');
        const targetDay = days[day - 1];
        if (targetDay) {
            targetDay.classList.add('selected');
        }
        
        this.selectedDate = new Date(year, month, day);
        this.openModal();
    }

    openModal() {
        const modal = document.getElementById('eventModal');
        if (!modal) return;
        
        modal.style.display = 'flex';
        
        const dateKey = this.getDateKey(
            this.selectedDate.getFullYear(),
            this.selectedDate.getMonth(),
            this.selectedDate.getDate()
        );
        const existingEvents = this.events[dateKey] || [];
        
        const modalTitle = document.getElementById('modalTitle');
        const existingEventsDiv = document.getElementById('existingEvents');
        const eventsList = document.getElementById('eventsList');
        
        if (existingEvents.length > 0) {
            modalTitle.textContent = `Ereignisse am ${this.selectedDate.toLocaleDateString('de-DE')}`;
            existingEventsDiv.style.display = 'block';
            eventsList.innerHTML = '';
            
            existingEvents.forEach((event, index) => {
                const eventItem = document.createElement('div');
                eventItem.className = 'event-item';
                eventItem.style.borderLeftColor = event.color;
                
                eventItem.innerHTML = `
                    <div class="event-item-header">
                        <div>
                            <div class="event-item-title">${event.title}</div>
                            <div class="event-item-time">${event.time}</div>
                            ${event.reminder !== undefined ? `<div class="event-item-reminder">🔔 Erinnerung ${this.formatReminderTime(event.reminder)}</div>` : ''}
                        </div>
                        <div>
                            <button class="edit-event-btn" data-index="${index}">Bearbeiten</button>
                            <button class="delete-event-btn" data-index="${index}">Löschen</button>
                        </div>
                    </div>
                    ${event.description ? `<div class="event-item-description">${event.description}</div>` : ''}
                `;
                
                eventsList.appendChild(eventItem);
            });
            
            eventsList.querySelectorAll('.delete-event-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    this.deleteEvent(dateKey, index);
                });
            });
            
            eventsList.querySelectorAll('.edit-event-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    this.editEvent(dateKey, index);
                });
            });
        } else {
            modalTitle.textContent = 'Neues Ereignis';
            existingEventsDiv.style.display = 'none';
        }
        
        // Reset form
        const form = document.getElementById('eventForm');
        if (form) {
            form.reset();
            document.getElementById('reminderOptions').style.display = 'none';
        }
        
        const titleInput = document.getElementById('eventTitle');
        if (titleInput) {
            titleInput.focus();
        }
    }

    editEvent(dateKey, index) {
        const event = this.events[dateKey][index];
        if (!event) return;
        
        // Fill form with event data
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventTime').value = event.time;
        document.getElementById('eventDescription').value = event.description || '';
        
        // Set color
        const colorInput = document.querySelector(`input[name="eventColor"][value="${event.color}"]`);
        if (colorInput) colorInput.checked = true;
        
        // Set reminder
        if (event.reminder !== undefined) {
            document.getElementById('enableReminder').checked = true;
            document.getElementById('reminderOptions').style.display = 'block';
            
            // Convert minutes back to days, hours, minutes
            const days = Math.floor(event.reminder / 1440);
            const hours = Math.floor((event.reminder % 1440) / 60);
            const minutes = event.reminder % 60;
            
            document.getElementById('reminderDays').value = days;
            document.getElementById('reminderHours').value = hours;
            document.getElementById('reminderMinutes').value = minutes;
        }
        
        // Delete the old event
        this.events[dateKey].splice(index, 1);
        if (this.events[dateKey].length === 0) {
            delete this.events[dateKey];
        }
        
        // Update modal
        this.openModal();
    }

    deleteEvent(dateKey, index) {
        if (this.events[dateKey]) {
            this.events[dateKey].splice(index, 1);
            if (this.events[dateKey].length === 0) {
                delete this.events[dateKey];
            }
            this.saveData();
            
            switch(this.currentView) {
                case 'month':
                    this.renderCalendar();
                    break;
                case 'week':
                    this.renderWeekView();
                    break;
                case 'day':
                    this.renderDayView();
                    break;
                case 'year':
                    this.renderYearView();
                    break;
            }
            
            this.openModal();
            this.updateNotificationBadge();
        }
    }

    closeModal() {
        const modal = document.getElementById('eventModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        const form = document.getElementById('eventForm');
        if (form) {
            form.reset();
            document.getElementById('reminderOptions').style.display = 'none';
        }
    }

    saveEvent(e) {
        e.preventDefault();
        if (!this.selectedDate) return;
        
        const title = document.getElementById('eventTitle')?.value || '';
        const time = document.getElementById('eventTime')?.value || '';
        const description = document.getElementById('eventDescription')?.value || '';
        const colorInput = document.querySelector('input[name="eventColor"]:checked');
        const color = colorInput?.value || '#4A90E2';
        
        const event = {
            title,
            time,
            description,
            color,
            id: Date.now()
        };
        
        // Add reminder if enabled
        if (document.getElementById('enableReminder')?.checked) {
            const days = parseInt(document.getElementById('reminderDays')?.value || '0');
            const hours = parseInt(document.getElementById('reminderHours')?.value || '0');
            const minutes = parseInt(document.getElementById('reminderMinutes')?.value || '0');
            
            // Convert to total minutes
            event.reminder = (days * 1440) + (hours * 60) + minutes;
        }
        
        const dateKey = this.getDateKey(
            this.selectedDate.getFullYear(),
            this.selectedDate.getMonth(),
            this.selectedDate.getDate()
        );
        
        if (!this.events[dateKey]) {
            this.events[dateKey] = [];
        }
        
        this.events[dateKey].push(event);
        
        // Sort events by time
        this.events[dateKey].sort((a, b) => {
            if (a.time && b.time) {
                return a.time.localeCompare(b.time);
            }
            return 0;
        });
        
        this.saveData();
        
        switch(this.currentView) {
            case 'month':
                this.renderCalendar();
                break;
            case 'week':
                this.renderWeekView();
                break;
            case 'day':
                this.renderDayView();
                break;
            case 'year':
                this.renderYearView();
                break;
        }
        
        this.closeModal();
        this.updateNotificationBadge();
        
        // Show confirmation
        this.showNotificationToast('✅ Gespeichert', `Termin "${title}" wurde hinzugefügt`, color);
    }

    openNotificationSettings() {
        const modal = document.getElementById('notificationModal');
        if (!modal) return;
        
        modal.style.display = 'flex';
        
        // Update settings checkboxes
        document.getElementById('notificationEnabled').checked = this.notificationSettings.enabled;
        document.getElementById('dailyReminder').checked = this.notificationSettings.dailyReminder;
        document.getElementById('soundEnabled').checked = this.notificationSettings.soundEnabled;
        
        // Show upcoming reminders
        this.updateUpcomingReminders();
    }

    updateUpcomingReminders() {
        const container = document.getElementById('upcomingReminders');
        if (!container) return;
        
        container.innerHTML = '';
        
        const now = new Date();
        const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        let upcomingEvents = [];
        
        // Collect events in next 24 hours
        for (let date = new Date(now); date <= next24Hours; date.setDate(date.getDate() + 1)) {
            const dateKey = this.getDateKey(date.getFullYear(), date.getMonth(), date.getDate());
            const events = this.events[dateKey] || [];
            
            events.forEach(event => {
                if (event.time && event.reminder !== undefined) {
                    const [hours, minutes] = event.time.split(':');
                    const eventDate = new Date(date);
                    eventDate.setHours(parseInt(hours), parseInt(minutes), 0);
                    
                    if (eventDate > now && eventDate <= next24Hours) {
                        upcomingEvents.push({
                            ...event,
                            eventDate,
                            dateKey
                        });
                    }
                }
            });
        }
        
        // Sort by date
        upcomingEvents.sort((a, b) => a.eventDate - b.eventDate);
        
        if (upcomingEvents.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Keine anstehenden Erinnerungen</p>';
        } else {
            upcomingEvents.forEach(event => {
                const reminderDiv = document.createElement('div');
                reminderDiv.style.cssText = `
                    background: var(--surface-light);
                    padding: 8px;
                    margin: 4px 0;
                    border-radius: 8px;
                    border-left: 3px solid ${event.color};
                `;
                
                const reminderTime = new Date(event.eventDate.getTime() - event.reminder * 60000);
                
                reminderDiv.innerHTML = `
                    <div style="font-weight: 600;">${event.title}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        ${event.eventDate.toLocaleDateString('de-DE')} um ${event.time}
                    </div>
                    <div style="font-size: 12px; color: var(--accent-color);">
                        🔔 Erinnerung um ${reminderTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                `;
                
                container.appendChild(reminderDiv);
            });
        }
    }

    closeNotificationModal() {
        const modal = document.getElementById('notificationModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    goToToday() {
        this.currentDate = new Date();
        
        switch(this.currentView) {
            case 'month':
                this.renderCalendar();
                break;
            case 'week':
                this.renderWeekView();
                break;
            case 'day':
                this.renderDayView();
                break;
            case 'year':
                this.renderYearView();
                break;
        }
        
        this.updateNotificationBadge();
    }

    getDateKey(year, month, day) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
}

// Initialize the calendar when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new CalendarApp();
    });
} else {
    new CalendarApp();
}