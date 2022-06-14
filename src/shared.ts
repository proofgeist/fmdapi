import { ensureFileSync, readFileSync, writeFileSync } from "fs-extra";

let data: Record<string, string> = {};
const devFileName = "shared.json";

const setSharedData = (key: string, value: string) => {
  data[key] = value;
  if (process.env.NODE_ENV === "development") {
    ensureFileSync(devFileName);
    writeFileSync(devFileName, JSON.stringify(data, null, 2));
  }
};
const getSharedData = (key: string): string | null => {
  if (process.env.NODE_ENV === "development") {
    ensureFileSync(devFileName);
    data = JSON.parse(readFileSync(devFileName, "utf8"));
  }
  return data[key];
};
export { setSharedData, getSharedData };
