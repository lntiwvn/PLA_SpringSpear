import { EventMap } from "./EventMap";

declare global {
	interface Window {
		gtag: (...args: any[]) => void;
	}
}

declare module 'cc' {
	export namespace GoogleAnalyticsTracker {
		function sendEvent(event: EventMap, data?: {}): void;
		function isDebug(): boolean;
	}
}
