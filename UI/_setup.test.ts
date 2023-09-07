import { EventBus } from "../event-bus.ts";
import { UI_Interaction_Event } from "./app_update.ts";

export const eventBus = new EventBus<UI_Interaction_Event>();
