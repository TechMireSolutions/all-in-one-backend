// backend/services/duplicateService.js

/**
 * Calculates the Jaro-Winkler similarity between two strings.
 * Returns a value between 0.0 (completely different) and 1.0 (identical).
 */
export const calculateJaroWinkler = (s1, s2) => {
  if (!s1 || !s2) return 0.0;
  if (s1 === s2) return 1.0;

  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();

  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 || len2 === 0) return 0.0;

  const matchWindow = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(len2, i + matchWindow + 1);

    for (let j = start; j < end; j++) {
      if (matches2[j]) continue;
      if (str1[i] === str2[j]) {
        matches1[i] = true;
        matches2[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!matches1[i]) continue;
    while (!matches2[k]) k++;
    if (str1[i] !== str2[k]) {
      transpositions++;
    }
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3.0;

  // Winkler bonus
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(len1, len2));
  for (let i = 0; i < maxPrefix; i++) {
    if (str1[i] === str2[i]) {
      prefix++;
    } else {
      break;
    }
  }

  return jaro + prefix * 0.1 * (1.0 - jaro);
};

/**
 * Normalizes an address string for standard comparison.
 */
export const normalizeAddressField = (field) => {
  if (!field) return "";
  return field
    .toLowerCase()
    .replace(/\broad\b/g, "rd")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\blane\b/g, "ln")
    .replace(/\bapartment\b/g, "apt")
    .replace(/\bsuite\b/g, "ste")
    .replace(/[^a-z0-9]/g, "") // remove punctuation and whitespace after replacement
    .trim();
};

/**
 * Normalizes a phone number to standard digits only, ignoring formatting.
 */
export const normalizePhoneNumber = (phone) => {
  if (!phone) return "";
  // Keep only digits and plus
  return phone.replace(/[^0-9+]/g, "").trim();
};

/**
 * Checks a contact against all existing database records to find duplicates.
 * Returns an array of matches containing the matched contact and similarity details.
 */
export const findDuplicates = async (candidate, existingContacts) => {
  const duplicates = [];

  const candidateCnic = candidate.cnic ? candidate.cnic.trim() : "";
  const candidateFirstName = candidate.first_name ? candidate.first_name.trim() : "";
  const candidateLastName = candidate.last_name ? candidate.last_name.trim() : "";
  const candidateFullName = `${candidateFirstName} ${candidateLastName}`.trim();

  const candidatePhones = (candidate.phoneNumbers || []).map(p => normalizePhoneNumber(p.phone_number)).filter(Boolean);
  const candidateEmails = (candidate.emails || []).map(e => e.email_address.toLowerCase().trim()).filter(Boolean);
  const candidateAddresses = (candidate.addresses || []).map(addr => ({
    line1: normalizeAddressField(addr.address_line1),
    city: normalizeAddressField(addr.city),
    state: normalizeAddressField(addr.state)
  }));

  for (const existing of existingContacts) {
    // Skip matching against itself if update
    if (candidate.id && existing.id === candidate.id) continue;

    let score = 0;
    const matchReasons = [];
    let cnicMatch = false;
    let nameMatch = false;
    let phoneMatch = false;
    let emailMatch = false;
    let addressMatch = false;

    // 1. CNIC Matching - Absolute match (100% duplicate confidence if CNIC matches)
    const existingCnic = existing.cnic ? existing.cnic.trim() : "";
    if (candidateCnic && existingCnic && candidateCnic === existingCnic) {
      score = 100;
      cnicMatch = true;
      matchReasons.push("Exact CNIC Match");
    }

    // If there is an exact CNIC match, we can skip other calculation or set it to 100
    if (!cnicMatch) {
      // 2. Name Matching: Fuzzy Jaro-Winkler on Full Name and First/Last combinations
      const existingFullName = `${existing.first_name || ""} ${existing.last_name || ""}`.trim();
      const jwFullName = calculateJaroWinkler(candidateFullName, existingFullName);
      
      let highestNameScore = jwFullName;
      
      // Also try cross matching first/last in case user inverted them
      const existingInvertedName = `${existing.last_name || ""} ${existing.first_name || ""}`.trim();
      const jwInvertedName = calculateJaroWinkler(candidateFullName, existingInvertedName);
      if (jwInvertedName > highestNameScore) highestNameScore = jwInvertedName;

      if (highestNameScore > 0.85) {
        nameMatch = true;
        // Map 0.85 - 1.0 to 15% - 40% contribution to duplicate confidence
        const nameWeight = Math.round((highestNameScore - 0.85) * (40 / 0.15) + 15);
        score += nameWeight;
        matchReasons.push(`Fuzzy Name Match (${Math.round(highestNameScore * 100)}% similarity)`);
      }

      // 3. Contact Info Matching: Exact checks on Emails or Phones
      const existingEmails = (existing.emails || []).map(e => e.email_address.toLowerCase().trim()).filter(Boolean);
      let matchedEmail = null;
      for (const email of candidateEmails) {
        if (existingEmails.includes(email)) {
          matchedEmail = email;
          break;
        }
      }
      if (matchedEmail) {
        emailMatch = true;
        score += 35; // Email carries high weight
        matchReasons.push(`Exact Email Match (${matchedEmail})`);
      }

      const existingPhones = (existing.phoneNumbers || []).map(p => normalizePhoneNumber(p.phone_number)).filter(Boolean);
      let matchedPhone = null;
      for (const phone of candidatePhones) {
        if (existingPhones.includes(phone)) {
          matchedPhone = phone;
          break;
        }
      }
      if (matchedPhone) {
        phoneMatch = true;
        score += 35; // Phone carries high weight
        matchReasons.push(`Exact Phone Match (${matchedPhone})`);
      }

      // 4. Address Matching: Check for partial/exact overlaps in City, State, and Address Line 1
      const existingAddresses = (existing.addresses || []).map(addr => ({
        line1: normalizeAddressField(addr.address_line1),
        city: normalizeAddressField(addr.city),
        state: normalizeAddressField(addr.state)
      }));

      let matchedAddress = false;
      for (const cAddr of candidateAddresses) {
        for (const eAddr of existingAddresses) {
          if (cAddr.line1 && eAddr.line1 && cAddr.line1 === eAddr.line1) {
            let addrScore = 15; // Line 1 matches
            if (cAddr.city === eAddr.city) addrScore += 5;
            if (cAddr.state === eAddr.state) addrScore += 5;
            
            score += addrScore;
            matchedAddress = true;
            matchReasons.push("Address Line 1 Overlap");
            break;
          } else if (cAddr.city && eAddr.city && cAddr.city === eAddr.city && cAddr.state === eAddr.state) {
            // Same city and state but line 1 is different, weak overlap
            score += 5;
            matchedAddress = true;
            matchReasons.push(`Location Overlap (${cAddr.city}, ${cAddr.state})`);
            break;
          }
        }
        if (matchedAddress) break;
      }
    }

    // Limit score to 100% maximum
    score = Math.min(100, score);

    // If score passes duplicate threshold (e.g. 50% duplicate confidence or name+phone matching, or exact CNIC match)
    if (score >= 40 || cnicMatch) {
      duplicates.push({
        contact: existing,
        confidenceScore: score,
        matchReasons,
        details: {
          cnicMatch,
          nameMatch,
          phoneMatch,
          emailMatch,
          addressMatch,
        }
      });
    }
  }

  // Sort duplicates descending by confidence score
  return duplicates.sort((a, b) => b.confidenceScore - a.confidenceScore);
};
