// Returns an array of missing-field labels (Use Case 1/2 exception flow:
// "system identifies the missing information and prevents the record from being saved").
function missing(body, fields) {
  return fields.filter(([key]) => !String(body[key] || '').trim()).map(([, label]) => label);
}

module.exports = { missing };
