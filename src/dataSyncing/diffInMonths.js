function isDifferenceGreaterThanThreeMonths(dateStr1, dateStr2) {
    const date1 = new Date(dateStr1);
    const date2 = new Date(dateStr2);
  
    const year1 = date1.getFullYear();
    const year2 = date2.getFullYear();
    const month1 = date1.getMonth();
    const month2 = date2.getMonth();
  
    const febDays1 = (year1 % 4 == 0 && year1 % 100 != 0) || year1 % 400 == 0 ? 29 : 28;
    const febDays2 = (year2 % 4 == 0 && year2 % 100 != 0) || year2 % 400 == 0 ? 29 : 28;
  
    const days1 = month1 === 1 ? febDays1 : new Date(year1, month1 + 1, 0).getDate();
    const days2 = month2 === 1 ? febDays2 : new Date(year2, month2 + 1, 0).getDate();
  
    const diffInMs = Math.abs(date2.getTime() - date1.getTime());
    const diffInDays = Math.round(diffInMs / (1000 * 60 * 60 * 24));
    const diffInMonths = (date2.getMonth() + 12 * date2.getFullYear()) - (date1.getMonth() + 12 * date1.getFullYear());
    const diffInYears = diffInMonths / 12;
  
    return (diffInMonths > 3 || (diffInMonths == 3 && (days2 - date2.getDate()) + date1.getDate() > days1));
}
  