import React from 'react';

const ActivityCalendar = ({ data }) => {
    // Generate dates for the last year
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    
    // Adjust start date to be exactly 52 weeks ago or start of week to align grid
    // But for simplicity, let's stick to "one year ago" logic and handle alignment
    
    const dates = [];
    let currentDate = new Date(oneYearAgo);

    while (currentDate <= today) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Map data to a dictionary for easy lookup
    const activityMap = {};
    if (data) {
        data.forEach(item => {
            activityMap[item.date] = item.count;
        });
    }

    const getColor = (count) => {
        if (!count) return '#161b22'; // Empty
        if (count === 1) return '#0e4429'; // Level 1
        if (count === 2) return '#006d32'; // Level 2
        if (count === 3) return '#26a641'; // Level 3
        return '#39d353'; // Level 4
    };

    const getTooltip = (date, count) => {
        const dateString = date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
        if (!count) return `Brak aktywności w dniu ${dateString}`;
        return `${count} rozwiązanych zadań w dniu ${dateString}`;
    };

    // Group dates by week
    const weeks = [];
    let currentWeek = [];
    
    // Fill first week with empty days if needed to align with Sunday
    const firstDay = dates[0].getDay(); // 0 = Sunday
    for (let i = 0; i < firstDay; i++) {
        currentWeek.push(null);
    }

    dates.forEach(date => {
        currentWeek.push(date);
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    });
    
    if (currentWeek.length > 0) {
        weeks.push(currentWeek);
    }

    // Calculate month labels positions
    const monthLabels = [];
    let currentMonth = -1;
    
    weeks.forEach((week, index) => {
        // Check the first valid day in the week
        const firstDayInWeek = week.find(day => day !== null);
        if (firstDayInWeek) {
            const month = firstDayInWeek.getMonth();
            if (month !== currentMonth) {
                monthLabels.push({
                    month: firstDayInWeek.toLocaleDateString('pl-PL', { month: 'short' }),
                    index: index
                });
                currentMonth = month;
            }
        }
    });

    const dayLabels = ['Pn', '', 'Śr', '', 'Pt', '', '']; // Only show Mon, Wed, Fri

    return (
        <div className="activity-calendar-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            {/* Month Labels */}
            <div style={{ display: 'flex', marginLeft: '30px', marginBottom: '5px', fontSize: '0.75rem', color: '#aaa' }}>
                {monthLabels.map((label, i) => (
                    <div key={i} style={{ 
                        width: '14px', // Width of a cell + gap (approx)
                        marginRight: i < monthLabels.length - 1 
                            ? `${(monthLabels[i+1].index - label.index - 1) * 16}px` 
                            : '0' 
                    }}>
                        {label.month}
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex' }}>
                {/* Day Labels */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginRight: '8px', marginTop: '16px' }}>
                    {dayLabels.map((day, i) => (
                        <div key={i} style={{ height: '12px', fontSize: '0.7rem', color: '#aaa', lineHeight: '12px' }}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div className="activity-calendar" style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '10px' }}>
                    {weeks.map((week, weekIndex) => (
                        <div key={weekIndex} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {week.map((date, dayIndex) => {
                                // Skip day 0 (Sunday) if we want to start from Monday, but JS getDay() 0 is Sunday.
                                // GitHub starts with Sunday at top usually, or Monday depending on locale.
                                // Let's stick to standard 7 days column.
                                
                                if (!date) return <div key={dayIndex} style={{ width: '12px', height: '12px' }}></div>;
                                
                                const dateStr = date.toISOString().split('T')[0];
                                const count = activityMap[dateStr] || 0;
                                
                                return (
                                    <div 
                                        key={dateStr}
                                        title={getTooltip(date, count)}
                                        style={{
                                            width: '12px',
                                            height: '12px',
                                            backgroundColor: getColor(count),
                                            borderRadius: '2px',
                                            cursor: 'pointer'
                                        }}
                                    ></div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#aaa', marginTop: '10px', marginLeft: '30px' }}>
                <span>Mniej</span>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#161b22', borderRadius: '2px' }}></div>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#0e4429', borderRadius: '2px' }}></div>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#006d32', borderRadius: '2px' }}></div>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#26a641', borderRadius: '2px' }}></div>
                <div style={{ width: '12px', height: '12px', backgroundColor: '#39d353', borderRadius: '2px' }}></div>
                <span>Więcej</span>
            </div>
        </div>
    );
};

export default ActivityCalendar;
