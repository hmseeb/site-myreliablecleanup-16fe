/* =========================================================
   Myreliablecleanup — GoHighLevel lead intake
   ---------------------------------------------------------
   Receives every website contact/quote form submission and
   creates or updates the matching contact in the GoHighLevel
   sub-account (location) below.

   On each submission it:
     - upserts the contact (first name, last name, phone, email)
     - sets the custom field "Lead Source"  -> "Website"
     - sets the custom field "Website Form" -> the form name
     - adds the tag "website-lead"
     - attaches the visitor's message as a contact note

   Required environment variable:
     GHL_API_KEY  — GoHighLevel Private Integration token (v2 API)
                    with contacts.write / contacts.readonly and
                    locations/customFields scopes.
     (GHL_LOCATION_ID optionally overrides the location below.)
   ========================================================= */

'use strict';

var API_BASE = 'https://services.leadconnectorhq.com';
var API_VERSION = '2021-07-28';
var DEFAULT_LOCATION_ID = 'Z7fPHa6A0oxgVKIkRW3Y';
var LEAD_TAG = 'website-lead';
var LEAD_SOURCE_FIELD = 'Lead Source';
var WEBSITE_FORM_FIELD = 'Website Form';
var LEAD_SOURCE_VALUE = 'Website';

// Cached per warm lambda so we only look the field ids up once.
var customFieldCache = null;

function token() {
  return (
    process.env.GHL_API_KEY ||
    process.env.GHL_PRIVATE_INTEGRATION_TOKEN ||
    process.env.HIGHLEVEL_API_KEY ||
    ''
  ).trim();
}

function locationId() {
  return (process.env.GHL_LOCATION_ID || DEFAULT_LOCATION_ID).trim();
}

function headers() {
  return {
    Authorization: 'Bearer ' + token(),
    Version: API_VERSION,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
}

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/* Split "Jane Q. Smith" into first / last name. */
function splitName(full) {
  var parts = str(full).split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function validPhone(value) {
  var digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/* US numbers arrive as "(940) 372-1737" — GHL prefers E.164. */
function normalisePhone(value) {
  var raw = str(value);
  if (!raw) return '';
  if (raw.charAt(0) === '+') return '+' + raw.slice(1).replace(/\D/g, '');
  var digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.charAt(0) === '1') return '+' + digits;
  return '+' + digits;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  var chunks = [];
  for await (var chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return {}; }
}

async function ghl(path, options) {
  var opts = options || {};
  var res = await fetch(API_BASE + path, {
    method: opts.method || 'GET',
    headers: headers(),
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });

  var text = await res.text();
  var data = {};
  if (text) { try { data = JSON.parse(text); } catch (e) { data = { raw: text }; } }

  if (!res.ok) {
    var err = new Error('GoHighLevel ' + path + ' failed (' + res.status + ')');
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

/* ---------------------------------------------------------
   Custom fields — resolve "Lead Source" / "Website Form" to
   their ids in this location, creating them if they're absent.
   --------------------------------------------------------- */
async function listCustomFields() {
  var data = await ghl('/locations/' + locationId() + '/customFields?model=contact');
  return data.customFields || data.customField || [];
}

async function createCustomField(name) {
  var data = await ghl('/locations/' + locationId() + '/customFields', {
    method: 'POST',
    body: {
      name: name,
      dataType: 'TEXT',
      model: 'contact',
      placeholder: name
    }
  });
  return data.customField || data;
}

async function resolveCustomFieldIds() {
  if (customFieldCache) return customFieldCache;

  var wanted = [LEAD_SOURCE_FIELD, WEBSITE_FORM_FIELD];
  var map = {};
  var existing = [];

  try {
    existing = await listCustomFields();
  } catch (e) {
    // Read scope missing — carry on, the upsert can still fall back to keys.
    existing = [];
  }

  wanted.forEach(function (name) {
    var match = existing.filter(function (field) {
      return str(field && field.name).toLowerCase() === name.toLowerCase();
    })[0];
    if (match && match.id) map[name] = match.id;
  });

  for (var i = 0; i < wanted.length; i++) {
    if (map[wanted[i]]) continue;
    try {
      var created = await createCustomField(wanted[i]);
      if (created && created.id) map[wanted[i]] = created.id;
    } catch (e) {
      // Field couldn't be created (already exists / no permission) — fall back below.
    }
  }

  customFieldCache = map;
  return map;
}

function customFieldPayload(ids, formName) {
  var values = {};
  values[LEAD_SOURCE_FIELD] = LEAD_SOURCE_VALUE;
  values[WEBSITE_FORM_FIELD] = formName;

  return Object.keys(values).map(function (name) {
    var entry = { field_value: values[name] };
    if (ids[name]) {
      entry.id = ids[name];
    } else {
      // Fall back to the conventional field key when we have no id.
      entry.key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    }
    return entry;
  });
}

/* Everything the visitor typed, kept as a note so nothing is lost. */
function buildNote(lead) {
  var lines = [
    'Website form submission — ' + lead.formName,
    '',
    'Name: ' + (lead.name || '—'),
    'Phone: ' + (lead.phone || '—'),
    'Email: ' + (lead.email || '—')
  ];
  if (lead.service) lines.push('Service needed: ' + lead.service);
  if (lead.location) lines.push('Job location: ' + lead.location);
  if (lead.timing) lines.push('Preferred timing: ' + lead.timing);
  if (lead.pageUrl) lines.push('Page: ' + lead.pageUrl);
  lines.push('', 'Message:', lead.message || '—');
  return lines.join('\n');
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  var body = await readBody(req);

  // Honeypot — pretend everything went fine, store nothing.
  if (str(body.company_website)) {
    res.status(200).json({ ok: true });
    return;
  }

  var names = splitName(body.name);
  var firstName = str(body.firstName) || names.firstName;
  var lastName = str(body.lastName) || names.lastName;
  var phone = str(body.phone);
  var email = str(body.email);
  var message = str(body.details) || str(body.message);
  var formName = str(body.formName) || 'Website Form';

  if (!firstName) {
    res.status(400).json({ ok: false, error: 'Please enter your name.' });
    return;
  }
  if (!phone && !email) {
    res.status(400).json({ ok: false, error: 'Please provide a phone number or an email address.' });
    return;
  }
  if (phone && !validPhone(phone)) {
    res.status(400).json({ ok: false, error: 'Please enter a valid phone number.' });
    return;
  }
  if (email && !validEmail(email)) {
    res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
    return;
  }

  if (!token()) {
    console.error('GHL_API_KEY is not configured — cannot deliver the lead.');
    res.status(503).json({ ok: false, error: 'The form is temporarily unavailable. Please call us instead.' });
    return;
  }

  var lead = {
    name: str(body.name) || (firstName + ' ' + lastName).trim(),
    firstName: firstName,
    lastName: lastName,
    phone: phone,
    email: email,
    message: message,
    service: str(body.service),
    location: str(body.location),
    timing: str(body.timing),
    formName: formName,
    pageUrl: str(body.pageUrl)
  };

  try {
    var fieldIds = await resolveCustomFieldIds();

    var payload = {
      locationId: locationId(),
      firstName: firstName,
      name: lead.name,
      tags: [LEAD_TAG],
      source: LEAD_SOURCE_VALUE,
      customFields: customFieldPayload(fieldIds, formName)
    };
    if (lastName) payload.lastName = lastName;
    if (email) payload.email = email;
    if (phone) payload.phone = normalisePhone(phone);

    var result = await ghl('/contacts/upsert', { method: 'POST', body: payload });
    var contact = result.contact || result;
    var contactId = contact && (contact.id || contact.contactId);

    if (contactId) {
      try {
        await ghl('/contacts/' + contactId + '/notes', {
          method: 'POST',
          body: { body: buildNote(lead) }
        });
      } catch (noteError) {
        // The contact is saved; a missing note shouldn't fail the submission.
        console.error('GoHighLevel note failed:', noteError.message, noteError.details || '');
      }
    }

    res.status(200).json({ ok: true, contactId: contactId || null });
  } catch (error) {
    console.error('GoHighLevel lead failed:', error.message, error.details || '');
    res.status(502).json({
      ok: false,
      error: "We couldn't send your request just now. Please call us and we'll get you booked in."
    });
  }
};
