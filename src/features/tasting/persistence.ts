import { accountStorage as AsyncStorage } from "../auth/account-storage";
import { createTastingDraftStorage } from "./draft-storage";
const storage = createTastingDraftStorage(AsyncStorage);
export const persistDraft = storage.persist;
export const restoreDraft = storage.restore;
export const clearDraft = storage.clear;
