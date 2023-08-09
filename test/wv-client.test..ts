import { DataApiWV as DataApi } from "../src";

describe("try to init client", () => {
  test("without layout", () => {
    expect(() =>
      DataApi({
        scriptName: "ExecuteDataApi",
      })
    );
  });
  test("without scriptName", () => {
    // @ts-expect-error the object is missing properties
    expect(() => DataApi({})).toThrow();
  });
});
