import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  cacheClearAll,
  cacheGet,
  cacheRemove,
  cacheSet,
} from "../../src/utils/cache";

describe("cache utils offline tests", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("cacheSet and cacheGet should persist and read value", async () => {
    await cacheSet("profile", { id: 1, name: "Jose" });
    const value = await cacheGet("profile");
    expect(value).toEqual({ id: 1, name: "Jose" });
  });

  it("cacheRemove should delete key", async () => {
    await cacheSet("profile", { id: 1 });
    await cacheRemove("profile");
    const value = await cacheGet("profile");
    expect(value).toBeNull();
  });

  it("cacheClearAll should clear only prefixed cache keys", async () => {
    await cacheSet("a", { ok: true });
    await cacheSet("b", { ok: true });
    await AsyncStorage.setItem("external_key", JSON.stringify({ keep: true }));

    await cacheClearAll();

    const a = await cacheGet("a");
    const b = await cacheGet("b");
    const external = await AsyncStorage.getItem("external_key");

    expect(a).toBeNull();
    expect(b).toBeNull();
    expect(external).toEqual(JSON.stringify({ keep: true }));
  });
});
