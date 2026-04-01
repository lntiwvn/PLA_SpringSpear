window.trackingConfig = {
    id: "G-NY24GPNB62",
    isDebug: false,
    game_name: "TS", // ten game
    pla_number: 19, //num kich ban
    network: window.super_html_channel,
    event_name_map: {
        INFO: "info",
        STARTING: "starting",
        IMPRESSION: "impression",
        ERROR: "error",
        ENGAGEMENT: "engagement",
        CTA: "cta",
        PLACE_ITEM: "place_item",
        CTA_BOTTOM: "cta_bottom",
        CTA_POPUP_NEXT_LEVEL: "cta_popup_next_level",
        CTA_POPUP_TIME_END: "cta_popup_time_end",
        NEXT_LEVEL: "next_level",
        LEVEL_COMPLETE_SHOW: "level_complete_show",
        LEVEL_TIME_END_SHOW: "level_time_end_show",
        REPLAY: "replay",
    },
    channel_name_map: {
        unity: "UY",
        ironsource: "IS",
        ironsource2025: "IS",
        mintegral: "MT",
        applovin: "AL",
    },
    getAliasChannelName(fullname) {
        const name = !!fullname ? fullname : this.network;
        return this.channel_name_map[name];
    },
};

window.dataLayer = window.dataLayer || [];

window.gtag = function gtag() {
    dataLayer.push(arguments);
};
class GoogleAnalyticsTracker {
    _isDebug = false;

    constructor(id, isDebug = false) {
        this._isDebug = isDebug;

        window.gtag("js", new Date());
        if (isDebug) {
            window.gtag("config", id, { debug_mode: true });
        } else {
            window.gtag("config", id);
        }
    }

    formatEventName(eventName) {
        const { game_name, pla_number } = window.trackingConfig;
        const eventNameMap = window.trackingConfig.event_name_map[eventName];
        return `${game_name}_${pla_number}_${eventNameMap}`;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");
        return `${hours}:${minutes}:${seconds}`;
    }

    sendEvent(event, data = null) {
        const network = window.trackingConfig.getAliasChannelName();
        const eventData = data ? { ...data, network } : { network };

        window.gtag("event", this.formatEventName(event), eventData);

        if (this._isDebug) {
            console.warn(`[${this.formatTime(Date.now())}] Tracking event ${this.formatEventName(event)} `, eventData);
        }
    }

    isDebug() {
        return this._isDebug;
    }
}
const { id, isDebug } = window.trackingConfig;

window.GoogleAnalyticsTracker = new GoogleAnalyticsTracker(id, isDebug);
