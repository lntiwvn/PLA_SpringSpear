import { PREVIEW } from 'cc/env';
import { EventMap } from './EventMap';
import { GoogleAnalyticsTracker } from 'cc';

export class TrackingWrapper {
	sendEvent(event: EventMap, data?: {}): void {
		const dataSend = { ...data };

		if (PREVIEW) {
			console.warn('Debug tracking', event, dataSend);
		} else {
			console.log('Debug tracking', event, dataSend);
		}

		if (data) {
			GoogleAnalyticsTracker?.sendEvent(event, dataSend);
		} else {
			GoogleAnalyticsTracker?.sendEvent(event);
		}
	}
}
