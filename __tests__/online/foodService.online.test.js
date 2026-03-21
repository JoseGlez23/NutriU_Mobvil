jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = require("../../src/lib/supabase");
const { foodService } = require("../../src/services/foodService");

describe("foodService online tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registerFood should insert with id_paciente and return data", async () => {
    const single = jest.fn().mockResolvedValue({
      data: { id_registro: 1, id_paciente: 7 },
      error: null,
    });
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));

    supabase.from.mockReturnValue({ insert });

    const payload = {
      cantidad: 120,
      calorias_totales: 300,
      fecha: "2026-03-17",
      tipo_comida: "comida",
    };

    const result = await foodService.registerFood(7, payload);

    expect(supabase.from).toHaveBeenCalledWith("registro_alimentos");
    expect(insert).toHaveBeenCalledWith({ id_paciente: 7, ...payload });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id_registro: 1, id_paciente: 7 });
  });

  it("getAvailableFoods should request alimentos ordered by nombre", async () => {
    const order = jest
      .fn()
      .mockResolvedValue({ data: [{ id_alimento: 1 }], error: null });
    const select = jest.fn(() => ({ order }));

    supabase.from.mockReturnValue({ select });

    const result = await foodService.getAvailableFoods();

    expect(supabase.from).toHaveBeenCalledWith("alimentos");
    expect(select).toHaveBeenCalledWith("*");
    expect(order).toHaveBeenCalledWith("nombre");
    expect(result.data).toEqual([{ id_alimento: 1 }]);
  });
});
