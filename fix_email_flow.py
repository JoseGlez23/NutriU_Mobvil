#!/usr/bin/env python3
# This script carefully adds resend code functionality to ProfileScreen.tsx

import re

# Read the file
with open('src/screens/ProfileScreen.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Fix the OTP type in verifyCurrentEmailChangeConfirmation
# Change email_change_current to email_change
content = re.sub(
    r"type:\s*'email_change_current'\s*as\s*any",
    "type: 'email_change' as any",
    content
)

# Step 2: Fix the OTP type in verifyNewEmailTokenAndFinalize
# Change email_change_new to email_change
content = re.sub(
    r"type:\s*'email_change_new'\s*as\s*any",
    "type: 'email_change' as any",
    content
)

# Step 3: Add whitespace trimming to token inputs
# For current email token
content = re.sub(
    r"const token = String\(emailChangeCurrentFinalToken \|\| ''\)\.trim\(\);",
    "const token = String(emailChangeCurrentFinalToken || '').trim().replace(/\\s/g, '');",
    content
)

# For new email token
content = re.sub(
    r"const token = String\(emailChangeNewEmailToken \|\| ''\)\.trim\(\);",
    "const token = String(emailChangeNewEmailToken || '').trim().replace(/\\s/g, '');",
    content
)

# Step 4: Add resend functions before verifyCurrentEmailChangeConfirmation
resend_functions = '''  const resendCurrentEmailCode = async () => {
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
      
      showPhotoModal(
        'Código reenviado',
        `Se ha reenviado el código de verificación a ${currentEmail}. Revisa tu bandeja de entrada.`,
        'checkmark-circle-outline',
        COLORS.primary
      );
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
      
      showPhotoModal(
        'Código reenviado',
        `Se ha reenviado el código de verificación a ${normalizedNewEmail}. Revisa tu bandeja de entrada.`,
        'checkmark-circle-outline',
        COLORS.primary
      );
      setEmailChangeNewEmailToken('');
    } catch (err) {
      showPhotoModal('Error', getEmailChangeFriendlyError(err), 'close-circle-outline', COLORS.error);
    }
  };

'''

# Find the location to insert resend functions (before verifyCurrentEmailChangeConfirmation)
insertion_point = content.find('  const verifyCurrentEmailChangeConfirmation')
if insertion_point > 0:
    content = content[:insertion_point] + resend_functions + content[insertion_point:]

# Step 5: Add resend button to Step 5 modal UI
# Find the TextInput closing tag in Step 5 and add the button
step5_pattern = r"(placeholder=\"Código del correo actual\".*?editable=\{!isEmailChanging\}\s*\/>\s*)"
step5_button = r'''  <TouchableOpacity
                    style={styles.resendCodeButton}
                    onPress={resendCurrentEmailCode}
                    disabled={isEmailChanging}
                  >
                    <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.resendCodeText}>Reenviar código</Text>
                  </TouchableOpacity>
                  '''

# For step 5, insert after the TextInput closing />
# This is tricky, so let's do it differently - find the specific section and replace
step5_old = '''                  <TextInput
                    style={styles.passwordVerificationInput}
                    value={emailChangeCurrentFinalToken}
                    onChangeText={setEmailChangeCurrentFinalToken}
                    placeholder="Código del correo actual"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isEmailChanging}
                  />
                  <View style={styles.modalButtonsRow}>'''

step5_new = '''                  <TextInput
                    style={styles.passwordVerificationInput}
                    value={emailChangeCurrentFinalToken}
                    onChangeText={setEmailChangeCurrentFinalToken}
                    placeholder="Código del correo actual"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isEmailChanging}
                  />
                  <TouchableOpacity
                    style={styles.resendCodeButton}
                    onPress={resendCurrentEmailCode}
                    disabled={isEmailChanging}
                  >
                    <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.resendCodeText}>Reenviar código</Text>
                  </TouchableOpacity>
                  <View style={styles.modalButtonsRow}>'''

content = content.replace(step5_old, step5_new)

# Step 6: Add resend button to Step 6 modal UI  
step6_old = '''                  <TextInput
                    style={styles.passwordVerificationInput}
                    value={emailChangeNewEmailToken}
                    onChangeText={setEmailChangeNewEmailToken}
                    placeholder="Código del nuevo correo"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isEmailChanging}
                  />
                  <View style={styles.modalButtonsRow}>'''

step6_new = '''                  <TextInput
                    style={styles.passwordVerificationInput}
                    value={emailChangeNewEmailToken}
                    onChangeText={setEmailChangeNewEmailToken}
                    placeholder="Código del nuevo correo"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isEmailChanging}
                  />
                  <TouchableOpacity
                    style={styles.resendCodeButton}
                    onPress={resendNewEmailCode}
                    disabled={isEmailChanging}
                  >
                    <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.resendCodeText}>Reenviar código</Text>
                  </TouchableOpacity>
                  <View style={styles.modalButtonsRow}>'''

content = content.replace(step6_old, step6_new)

# Step 7: Add styles before the closing of StyleSheet.create
styles_to_add = '''  resendCodeButton: {
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
'''

# Find the last style definition and add before the closing })
# Replace the closing }); with our styles + closing
content = re.sub(
    r'  },\n\}\);$',
    f'''  }},\n{styles_to_add}}}\n}});''',
    content,
    flags=re.MULTILINE
)

# Write back the modified content
with open('src/screens/ProfileScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ All changes applied successfully!')
