import {
  getFromCache,
  removeFromCache,
  saveToCache,
} from "../../src/utils/offlineCache";

describe("Offline Mode Tests", () => {
  beforeEach(async () => {
    await saveToCache("testKey", { data: "testData" });
  });

  it("should retrieve cached data", async () => {
    const data = await getFromCache("testKey");
    expect(data).toEqual({ data: "testData" });
  });

  it("should handle missing cache gracefully", async () => {
    const data = await getFromCache("missingKey");
    expect(data).toBeNull();
  });

  it("should remove cached data", async () => {
    await removeFromCache("testKey");
    const data = await getFromCache("testKey");
    expect(data).toBeNull();
  });

  it("should overwrite cached data", async () => {
    await saveToCache("testKey", { data: "updated" });
    const data = await getFromCache("testKey");
    expect(data).toEqual({ data: "updated" });
  });
});
