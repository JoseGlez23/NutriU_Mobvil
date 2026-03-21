#!/usr/bin/env python3
import re

with open('src/screens/ProfileScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix OTP types
content = content.replace("type: 'email_change_current' as any", "type: 'email_change' as any")
content = content.replace("type: 'email_change_new' as any", "type: 'email_change' as any")

# Add resend functions
resend_funcs = '''const resendCurrentEmailCode = async () => {
    try {
      const currentEmail = String(authUser?.email || user?.correo || '').trim().toLowerCase();
      const { error } = await supabase.auth.resend({
        type: 'email_change' as any,
        email: currentEmail,
      });
      if (error) {
        showPhotoModal('Error', `No pudimos reenviar el código: ${error.message}`, 'warning-outline', '#FFA500');
        return;
      }
      showPhotoModal('Código reenviado', `Se ha reenviado el código de verificación a ${currentEmail}. Revisa tu bandeja de entrada.`, 'checkmark-circle-outline', COLORS.primary);
      setEmailChangeCurrentFinalToken('');
    } catch (err) {
      showPhotoModal('Error', getEmailChangeFriendlyError(err), 'close-circle-outline', COLORS.error);
    }
  };

const resendNewEmailCode = async () => {
    try {
      const normalizedNewEmail = String(emailChangeNewEmail || '').trim().toLowerCase();
      const { error } = await supabase.auth.resend({
        type: 'email_change' as any,
        email: normalizedNewEmail,
      });
      if (error) {
        showPhotoModal('Error', `No pudimos reenviar el código: ${error.message}`, 'warning-outline', '#FFA500');
        return;
      }
      showPhotoModal('Código reenviado', `Se ha reenviado el código de verificación a ${normalizedNewEmail}. Revisa tu bandeja de entrada.`, 'checkmark-circle-outline', COLORS.primary);
      setEmailChangeNewEmailToken('');
    } catch (err) {
      showPhotoModal('Error', getEmailChangeFriendlyError(err), 'close-circle-outline', COLORS.error);
    }
  };

'''

# Insert resend functions before verifyCurrentEmailChangeConfirmation
insertion_point = content.find('const verifyCurrentEmailChangeConfirmation')
if insertion_point > 0:
    content = content[:insertion_point] + resend_funcs + content[insertion_point:]

# Add buttons to UI Step 5
step5_old = '''placeholder="Código del correo actual"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isEmailChanging}
                  />
                  <View style={styles.modalButtonsRow}>'''

step5_new = '''placeholder="Código del correo actual"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isEmailChanging}
                  />
                  <TouchableOpacity style={styles.resendCodeButton} onPress={resendCurrentEmailCode} disabled={isEmailChanging}>
                    <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.resendCodeText}>Reenviar código</Text>
                  </TouchableOpacity>
                  <View style={styles.modalButtonsRow}>'''

content = content.replace(step5_old, step5_new)

# Add buttons to UI Step 6
step6_old = '''placeholder="Código del nuevo correo"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isEmailChanging}
                  />
                  <View style={styles.modalButtonsRow}>'''

step6_new = '''placeholder="Código del nuevo correo"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isEmailChanging}
                  />
                  <TouchableOpacity style={styles.resendCodeButton} onPress={resendNewEmailCode} disabled={isEmailChanging}>
                    <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.resendCodeText}>Reenviar código</Text>
                  </TouchableOpacity>
                  <View style={styles.modalButtonsRow}>'''

content = content.replace(step6_old, step6_new)

# Add styles before closing
old_ending = '  },\n});'
new_styles = '''  },
  resendCodeButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  resendCodeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 8,
  },
});'''

content = content.replace(old_ending, new_styles)

with open('src/screens/ProfileScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ Email change flow updated successfully!')
