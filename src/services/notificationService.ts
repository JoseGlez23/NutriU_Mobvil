import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

// URL de tu backend
const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "https://carolin-nonprovisional-correctly.ngrok-free.dev";

/**
 * Configuración de cómo se manejan las notificaciones cuando la app está en foreground
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registra el dispositivo para recibir notificaciones push
 * @param pacienteId - ID del paciente en la base de datos
 * @returns Token de Expo o null si hay error
 */
export async function registerForPushNotifications(
  pacienteId: number,
): Promise<string | null> {
  try {
    // Solo funciona en dispositivos físicos
    if (!Device.isDevice) {
      console.warn(
        "[PUSH] Las notificaciones push solo funcionan en dispositivos físicos",
      );
      return null;
    }

    // Verificar permisos existentes
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Si no tiene permisos, solicitarlos
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("[PUSH] Permiso de notificaciones denegado");
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn(
        "[PUSH] No hay projectId de EAS; se omite registro de push en este build",
      );
      return null;
    }

    // Obtener el token de Expo
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

    const token = tokenData.data;

    if (!token) {
      console.error("[PUSH] No se pudo obtener el token");
      return null;
    }

    // Registrar el token en el backend
    const response = await fetch(
      `${BACKEND_URL}/notifications/register-token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pacienteId,
          token,
          deviceType: Platform.OS,
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "[PUSH] Error registrando token en el backend:",
        response.status,
      );
      return null;
    }

    const result = await response.json();
    console.log("[PUSH] Token registrado exitosamente:", result);

    // Configurar canal de notificaciones para Android
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Notificaciones de NutriU",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#2E8B57",
        sound: "default",
      });
    }

    return token;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      Platform.OS === "android" &&
      message.includes("FirebaseApp is not initialized")
    ) {
      console.warn(
        "[PUSH] FCM no configurado en Android. La app seguira funcionando sin push.",
      );
      return null;
    }
    console.error("[PUSH] Error registrando notificaciones:", error);
    return null;
  }
}

/**
 * Elimina el token del dispositivo del backend
 * @param pacienteId - ID del paciente
 * @param token - Token a eliminar
 */
export async function unregisterPushToken(
  pacienteId: number,
  token: string,
): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/notifications/remove-token`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pacienteId,
        token,
      }),
    });
    console.log("[PUSH] Token desregistrado exitosamente");
  } catch (error) {
    console.error("[PUSH] Error desregistrando token:", error);
  }
}

/**
 * Agrega un listener para cuando se recibe una notificación
 * @param callback - Función a ejecutar cuando llega una notificación
 * @returns Subscription que debe ser removida en cleanup
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void,
) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Agrega un listener para cuando el usuario toca una notificación
 * @param callback - Función a ejecutar cuando se toca una notificación
 * @returns Subscription que debe ser removida en cleanup
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Obtiene todas las notificaciones programadas
 */
export async function getScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Cancela todas las notificaciones programadas
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Limpia el badge de notificaciones
 */
export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0);
}

export interface MealReminderInput {
  diaSemana: number;
  tipoComida: string;
  descripcion?: string | null;
  horario?: string | null;
}

const MEAL_REMINDER_IDS_KEY = (pacienteId: number) =>
  `nutriu:mealReminderIds:${pacienteId}`;
const MEAL_REMINDER_SIGNATURE_KEY = (pacienteId: number) =>
  `nutriu:mealReminderSignature:${pacienteId}`;
const MEAL_REMINDER_CLEANUP_KEY = (pacienteId: number) =>
  `nutriu:mealReminderCleanupV3:${pacienteId}`;
const MISSED_MEAL_BACKFILL_WINDOW_MINUTES = 35;

const mealPlanSyncInFlight = new Map<
  number,
  Promise<{ scheduled: number; skipped: boolean }>
>();
const mealInboxSyncInFlight = new Map<
  number,
  Promise<{ created: number; skipped: boolean }>
>();

const parseHourMinute = (value?: string | null) => {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return { hour, minute };
};

const getTodayDiaSemana = (date = new Date()) => {
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
};

const getMinutes = (hour: number, minute: number) => hour * 60 + minute;

const toYmdLocal = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeWeekday = (diaSemana: number) => {
  if (!Number.isInteger(diaSemana)) return null;
  if (diaSemana < 1 || diaSemana > 7) return null;

  // dieta_detalle usa: 1=Lunes ... 7=Domingo
  // Expo/iOS usa weekday: 1=Domingo ... 7=Sábado
  return diaSemana === 7 ? 1 : diaSemana + 1;
};

const buildMealReminderSignature = (items: MealReminderInput[]) =>
  JSON.stringify(
    [...items]
      .map((item) => ({
        diaSemana: Number(item.diaSemana || 0),
        tipoComida: String(item.tipoComida || "")
          .trim()
          .toLowerCase(),
        descripcion: String(item.descripcion || "")
          .trim()
          .toLowerCase(),
        horario: String(item.horario || "").trim(),
      }))
      .sort((a, b) => {
        const dayDiff = a.diaSemana - b.diaSemana;
        if (dayDiff !== 0) return dayDiff;
        return `${a.horario}-${a.tipoComida}`.localeCompare(
          `${b.horario}-${b.tipoComida}`,
        );
      }),
  );

const buildReminderIdentity = (item: MealReminderInput) => {
  const diaSemana = Number(item.diaSemana || 0);
  const tipoComida = String(item.tipoComida || "")
    .trim()
    .toLowerCase();
  const horario = String(item.horario || "").trim();
  return `${diaSemana}|${tipoComida}|${horario}`;
};

export async function syncMealPlanNotifications(
  pacienteId: number,
  reminders: MealReminderInput[],
) {
  if (!pacienteId) return { scheduled: 0, skipped: true };

  const existingSync = mealPlanSyncInFlight.get(pacienteId);
  if (existingSync) {
    return existingSync;
  }

  const runSync = (async () => {
    try {
      const permission = await Notifications.getPermissionsAsync();
      if (permission.status !== "granted") {
        return { scheduled: 0, skipped: true };
      }

      const now = new Date();
      const todayDiaSemana = getTodayDiaSemana(now);
      const nowMinutes = getMinutes(now.getHours(), now.getMinutes());

      // Quita duplicados por dia/tipo/horario para evitar múltiples notificaciones iguales.
      const uniqueReminders = Array.from(
        new Map(
          reminders.map((item) => [buildReminderIdentity(item), item]),
        ).values(),
      );

      const validReminders = uniqueReminders.filter((item) => {
        const weekday = normalizeWeekday(Number(item.diaSemana));
        const parsed = parseHourMinute(item.horario);
        if (!weekday || !parsed) return false;

        // En Android, recordatorios semanales del día actual pero en hora pasada
        // pueden dispararse inmediatamente al programarlos. Se omiten aquí y se
        // reprograman en próximos inicios para evitar avalanchas.
        if (Number(item.diaSemana) === todayDiaSemana) {
          const reminderMinutes = getMinutes(parsed.hour, parsed.minute);
          if (reminderMinutes <= nowMinutes) {
            return false;
          }
        }

        return true;
      });

      const nextSignature = buildMealReminderSignature(validReminders);
      const signatureKey = MEAL_REMINDER_SIGNATURE_KEY(pacienteId);
      const idsKey = MEAL_REMINDER_IDS_KEY(pacienteId);
      const cleanupKey = MEAL_REMINDER_CLEANUP_KEY(pacienteId);

      const cleanupDone = await AsyncStorage.getItem(cleanupKey);
      if (!cleanupDone) {
        await Notifications.cancelAllScheduledNotificationsAsync().catch(
          () => null,
        );
        await AsyncStorage.multiRemove([signatureKey, idsKey]);
        await AsyncStorage.setItem(cleanupKey, "done");
      }

      const previousSignature = await AsyncStorage.getItem(signatureKey);

      if (previousSignature === nextSignature) {
        return { scheduled: 0, skipped: true };
      }

      const existingIdsRaw = await AsyncStorage.getItem(idsKey);
      const existingIds = existingIdsRaw ? JSON.parse(existingIdsRaw) : [];
      if (Array.isArray(existingIds) && existingIds.length > 0) {
        await Promise.all(
          existingIds.map((id: string) =>
            Notifications.cancelScheduledNotificationAsync(id).catch(
              () => null,
            ),
          ),
        );
      }

      if (validReminders.length === 0) {
        await AsyncStorage.multiSet([
          [signatureKey, nextSignature],
          [idsKey, "[]"],
        ]);
        return { scheduled: 0, skipped: false };
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Notificaciones de NutriU",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#2E8B57",
          sound: "default",
        });
      }

      const createdIds: string[] = [];

      for (const reminder of validReminders) {
        const weekday = normalizeWeekday(Number(reminder.diaSemana));
        const time = parseHourMinute(reminder.horario);
        if (!weekday || !time) continue;

        const title = `Hora de ${reminder.tipoComida}`;
        const body = reminder.descripcion
          ? `${reminder.descripcion}`
          : "Toca registrar tu alimento en NutriU.";

        const trigger: Notifications.NotificationTriggerInput = {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          weekday,
          hour: time.hour,
          minute: time.minute,
          repeats: true,
          ...(Platform.OS === "android" ? { channelId: "default" } : {}),
        } as Notifications.NotificationTriggerInput;

        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
            data: {
              type: "meal_reminder",
              pacienteId,
              tipoComida: reminder.tipoComida,
              diaSemana: reminder.diaSemana,
            },
          },
          trigger,
        });

        createdIds.push(id);
      }

      await AsyncStorage.multiSet([
        [signatureKey, nextSignature],
        [idsKey, JSON.stringify(createdIds)],
      ]);

      return { scheduled: createdIds.length, skipped: false };
    } catch (error) {
      console.warn(
        "[PUSH] No se pudieron sincronizar recordatorios de comida:",
        error,
      );
      return { scheduled: 0, skipped: true };
    }
  })();

  mealPlanSyncInFlight.set(pacienteId, runSync);

  try {
    return await runSync;
  } finally {
    mealPlanSyncInFlight.delete(pacienteId);
  }
}

export async function syncMissedMealRemindersToInbox(
  pacienteId: number,
  reminders: MealReminderInput[],
) {
  if (!pacienteId || !Array.isArray(reminders) || reminders.length === 0) {
    return { created: 0, skipped: true };
  }

  const existingSync = mealInboxSyncInFlight.get(pacienteId);
  if (existingSync) {
    console.log(
      "[PUSH] Sync de recordatorios vencidos ya en progreso, retornando sincronización anterior",
    );
    return existingSync;
  }

  const runSync = (async () => {
    try {
      const now = new Date();
      const todayDiaSemana = getTodayDiaSemana(now);
      const nowMinutes = getMinutes(now.getHours(), now.getMinutes());
      const todayYmd = toYmdLocal(now);

      console.log("[PUSH] Sincronizando recordatorios vencidos:", {
        ahora: now.toISOString(),
        diaDeLaSemana: todayDiaSemana,
        minutosDelDia: nowMinutes,
        totalRecordatorios: reminders.length,
      });

      const dueTodayRecent = reminders
        .map((reminder) => {
          const parsed = parseHourMinute(reminder.horario);
          return {
            reminder,
            parsed,
          };
        })
        .filter(({ reminder, parsed }) => {
          if (!parsed) return false;
          if (Number(reminder.diaSemana) !== todayDiaSemana) return false;
          const reminderMinutes = getMinutes(parsed.hour, parsed.minute);
          const diff = nowMinutes - reminderMinutes;
          return diff >= 0 && diff <= MISSED_MEAL_BACKFILL_WINDOW_MINUTES;
        })
        .sort((a, b) => {
          const aMinutes = a.parsed
            ? getMinutes(a.parsed.hour, a.parsed.minute)
            : -1;
          const bMinutes = b.parsed
            ? getMinutes(b.parsed.hour, b.parsed.minute)
            : -1;
          return bMinutes - aMinutes;
        })
        .slice(0, 1);

      if (dueTodayRecent.length === 0) {
        console.log(
          "[PUSH] No hay recordatorios vencidos en la ventana de 35 minutos",
        );
        return { created: 0, skipped: true };
      }

      console.log(
        "[PUSH] Recordatorios vencidos encontrados:",
        dueTodayRecent.length,
        {
          comidas: dueTodayRecent.map((item) => ({
            tipoComida: item.reminder.tipoComida,
            horario: item.reminder.horario,
            diaSemana: item.reminder.diaSemana,
          })),
        },
      );

      const candidateRows = dueTodayRecent.map(({ reminder }) => {
        const tipoComida = String(reminder.tipoComida || "Comida").trim();
        const descripcion = String(reminder.descripcion || "").trim();
        const horario = String(reminder.horario || "").trim();
        const hash = `meal-fallback|${pacienteId}|${todayYmd}|${tipoComida.toLowerCase()}|${horario}`;

        return {
          hash,
          row: {
            id_usuario: pacienteId,
            tipo_usuario: "paciente",
            titulo: `Hora de ${tipoComida}`,
            mensaje: descripcion || "Toca registrar tu alimento en NutriU.",
            tipo: "recordatorio",
            leida: false,
            fecha_envio: new Date().toISOString(),
            datos_adicionales: {
              subtipo: "meal_reminder",
              type: "meal_reminder",
              tipoComida,
              diaSemana: Number(reminder.diaSemana || 0),
              horario,
              destino: "FoodTracking",
              hash,
              source: "fallback",
            },
          },
        };
      });

      const lookbackIso = new Date(
        Date.now() - 48 * 60 * 60 * 1000,
      ).toISOString();
      const { data: recentRows, error: recentError } = await supabase
        .from("notificaciones")
        .select("id_notificacion, datos_adicionales")
        .eq("id_usuario", pacienteId)
        .eq("tipo_usuario", "paciente")
        .eq("tipo", "recordatorio")
        .gte("fecha_envio", lookbackIso)
        .limit(400);

      if (recentError) {
        console.warn(
          "[PUSH] No se pudieron leer recordatorios recientes:",
          recentError.message,
        );
      }

      const existingHashes = new Set(
        (recentRows || [])
          .map((item: any) => String(item?.datos_adicionales?.hash || ""))
          .filter(Boolean),
      );

      console.log("[PUSH] Deduplicación de recordatorios:", {
        existentesEnDB: existingHashes.size,
        hashes: Array.from(existingHashes),
      });

      const rowsToInsert = candidateRows
        .filter((candidate) => {
          const existe = existingHashes.has(candidate.hash);
          console.log("[PUSH] Filtrando candidato:", {
            hash: candidate.hash,
            yaExiste: existe,
            tipoComida: candidate.row.titulo,
          });
          return !existe;
        })
        .map((candidate) => candidate.row);

      if (rowsToInsert.length === 0) {
        console.log(
          "[PUSH] Todos los recordatorios ya existen en la BD, sin insertar",
        );
        return { created: 0, skipped: true };
      }

      const { error: insertError } = await supabase
        .from("notificaciones")
        .insert(rowsToInsert);

      if (insertError) {
        console.warn(
          "[PUSH] No se pudieron guardar recordatorios fallback:",
          insertError.message,
        );
        return { created: 0, skipped: true };
      }

      console.log("[PUSH] Recordatorios guardados exitosamente:", {
        cantidad: rowsToInsert.length,
        recordatorios: rowsToInsert.map((r) => ({
          titulo: r.titulo,
          tipo: r.tipo,
          usuario: r.id_usuario,
        })),
      });

      return { created: rowsToInsert.length, skipped: false };
    } catch (error) {
      console.warn("[PUSH] Error en fallback de recordatorios:", error);
      return { created: 0, skipped: true };
    }
  })();

  mealInboxSyncInFlight.set(pacienteId, runSync);

  try {
    return await runSync;
  } finally {
    mealInboxSyncInFlight.delete(pacienteId);
  }
}
