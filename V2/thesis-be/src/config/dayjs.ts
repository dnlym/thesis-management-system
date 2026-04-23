import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Lock to Vietnam timezone
dayjs.tz.setDefault('Asia/Ho_Chi_Minh');

export default dayjs;
