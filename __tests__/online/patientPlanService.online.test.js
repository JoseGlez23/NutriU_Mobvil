jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = require("../../src/lib/supabase");
const { patientPlanService } = require("../../src/services/patientPlanService");

describe("patientPlanService online tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns validation error when patient id is invalid", async () => {
    const result = await patientPlanService.clearActivePlans(NaN);
    expect(result).toEqual({
      success: false,
      error: "ID de paciente inválido",
    });
  });

  it("returns error when diet update fails", async () => {
    const dietaEqActiva = jest
      .fn()
      .mockResolvedValue({ error: { message: "dieta fail" } });
    const dietaEqPaciente = jest.fn(() => ({ eq: dietaEqActiva }));
    const dietaUpdate = jest.fn(() => ({ eq: dietaEqPaciente }));

    supabase.from.mockReturnValueOnce({ update: dietaUpdate });

    const result = await patientPlanService.clearActivePlans(10);

    expect(supabase.from).toHaveBeenCalledWith("dietas");
    expect(result).toEqual({ success: false, error: "dieta fail" });
  });

  it("returns success when diet and routine updates succeed", async () => {
    const dietaEqActiva = jest.fn().mockResolvedValue({ error: null });
    const dietaEqPaciente = jest.fn(() => ({ eq: dietaEqActiva }));
    const dietaUpdate = jest.fn(() => ({ eq: dietaEqPaciente }));

    const rutinaEqActiva = jest.fn().mockResolvedValue({ error: null });
    const rutinaEqPaciente = jest.fn(() => ({ eq: rutinaEqActiva }));
    const rutinaUpdate = jest.fn(() => ({ eq: rutinaEqPaciente }));

    supabase.from
      .mockReturnValueOnce({ update: dietaUpdate })
      .mockReturnValueOnce({ update: rutinaUpdate });

    const result = await patientPlanService.clearActivePlans(10);

    expect(supabase.from).toHaveBeenNthCalledWith(1, "dietas");
    expect(supabase.from).toHaveBeenNthCalledWith(2, "rutinas");
    expect(result).toEqual({ success: true });
  });
});
