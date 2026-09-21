import { cronJobs, anyApi } from 'convex/server';
const crons = cronJobs();
crons.daily('Archive WaniKani subject changes', { hourUTC: 3, minuteUTC: 15 }, anyApi.collector.collect);
export default crons;
