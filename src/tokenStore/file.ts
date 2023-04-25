import { TokenStoreDefinitions } from "./types";
import fs from "fs-extra";

function getDataFromFile(devFileName: string): Record<string, string> {
  const data: Record<string, string> = {};
  fs.ensureFileSync(devFileName);
  const fileString = fs.readFileSync(devFileName, "utf8");
  try {
    return JSON.parse(fileString);
  } catch {
    return data;
  }
}
const setSharedData = (key: string, value: string, devFileName: string) => {
  const data = getDataFromFile(devFileName);
  data[key] = value;
  fs.ensureFileSync(devFileName);
  fs.writeFileSync(devFileName, JSON.stringify(data, null, 2));
};
const getSharedData = (key: string, devFileName: string): string | null => {
  const data = getDataFromFile(devFileName);
  return data[key] ?? null;
};
export const fileTokenStore = (
  fileName = "shared.json"
): TokenStoreDefinitions => {
  return {
    setToken: (key, value) => setSharedData(key, value, fileName),
    getToken: (key) => getSharedData(key, fileName),
    clearToken: () => fs.removeSync(fileName),
  };
};
export default fileTokenStore;
