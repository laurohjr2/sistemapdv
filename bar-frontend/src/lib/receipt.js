export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function receiptHeader(business) {
  const lines=[business.legalName,business.cnpj&&`CNPJ: ${business.cnpj}`,business.address,
    [business.city,business.state,business.postalCode].filter(Boolean).join(' · '),business.phone,business.email];
  return `${business.logo?`<img src="${escapeHtml(business.logo)}" alt="Logo" style="max-width:100px;max-height:70px"/>`:''}<h1>${escapeHtml(business.companyName)}</h1>${lines.filter(Boolean).map(line=>`<p>${escapeHtml(line)}</p>`).join('')}`;
}
