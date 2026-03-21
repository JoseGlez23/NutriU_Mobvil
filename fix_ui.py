#!/usr/bin/env python3
import re

# Read the file
with open ('src/screens/ProfileScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and modify Step 5 - add resend button
step5_insert_marker = '                  />\n                  <View style={styles.modalButtonsRow}>'
step5_insert = '''                  />
                  <TouchableOpacity
                    style={styles.resendCodeButton}
                    onPress={resendCurrentEmailCode}
                    disabled={isEmailChanging}
                  >
                    <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.resendCodeText}>Reenviar código</Text>
                  </TouchableOpacity>
                  <View style={styles.modalButtonsRow}>'''

# Replace Step 5
content = ''.join(lines)
content = content.replace(
    '                  />\n                  <View style={styles.modalButtonsRow}>',
    step5_insert,
    1
)

# Find and modify Step 6 - add resend button (second occurrence)
step6_marker = 'emailChangeNewEmailToken'
lines_new = content.split('\n')
new_lines = []
found_step6 = False
for i, line in enumerate(lines_new):
    new_lines.append(line)
    if not found_step6 and 'PASO 6' in line and 'CONFIRMAR NUEVO CORREO' in line:
        found_step6 = True
    elif found_step6 and 'placeholder="Código del nuevo correo"' in line:
        # Add next 6 lines as they are (closing of TextInput)
        for j in range(1, 7):
            if i + j < len(lines_new):
                new_lines.append(lines_new[i + j])
        # Insert resend button AFTER TextInput closes
        new_lines.append('                  <TouchableOpacity')
        new_lines.append('                    style={styles.resendCodeButton}')
        new_lines.append('                    onPress={resendNewEmailCode}')
        new_lines.append('                    disabled={isEmailChanging}')
        new_lines.append('                  >')
        new_lines.append('                    <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />')
        new_lines.append('                    <Text style={styles.resendCodeText}>Reenviar código</Text>')
        new_lines.append('                  </TouchableOpacity>')
        found_step6 = False
        # Skip the lines we already added
        for j in range(1, 7):
            if i + j < len(lines_new):
                del lines_new[i + j]

updated_content = '\n'.join(new_lines)

# Add styles for the resend button
styles_marker = '  },\n});'
styles_insert = '''  },
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

updated_content = updated_content.replace(styles_marker, styles_insert)

# Write back
with open('src/screens/ProfileScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(updated_content)

print('✅ Profile screen UI updated successfully!')
