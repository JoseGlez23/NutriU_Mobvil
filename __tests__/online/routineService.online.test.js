jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = require("../../src/lib/supabase");
const { routineService } = require("../../src/services/routineService");

describe("routineService online tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getPatientRoutineExercises validates missing patient id", async () => {
    const result = await routineService.getPatientRoutineExercises();
    expect(result).toEqual({ data: [], error: "ID de paciente requerido" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("addExercise validates invalid patient id", async () => {
    const result = await routineService.addExercise(NaN, {
      name: "Sentadilla",
    });
    expect(result).toEqual({ data: null, error: "ID de paciente inválido" });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
