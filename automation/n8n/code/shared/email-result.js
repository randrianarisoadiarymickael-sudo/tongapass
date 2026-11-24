// Traduit le résultat du nœud « Send Email » en événement d'étape.
// __STEP_KEY__ est remplacé à la génération (email.welcome ou email.notify).
const result = $input.first().json;
const recipients = $('__COMPOSER__').first().json.to;
if (result.error) {
  const message = typeof result.error === 'string' ? result.error : result.error.message || JSON.stringify(result.error);
  return [stepEvent('__STEP_KEY__', 'FAILED', `envoi impossible : ${String(message).slice(0, 200)}`)];
}
return [stepEvent('__STEP_KEY__', 'SUCCEEDED', `E-mail envoyé à ${recipients}`, { messageId: String(result.messageId || '') })];
