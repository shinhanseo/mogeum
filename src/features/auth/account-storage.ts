import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAccountStorage } from "./account-storage-core";
export const accountStorage = createAccountStorage(AsyncStorage);
