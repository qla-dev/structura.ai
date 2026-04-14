import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OfferState, Language } from '../types';
import { PRICING_LOGIC } from '../constants';

export const generateOfferPDF = (state: OfferState) => {
  const doc = new jsPDF();
  const lang = state.language;
  const isEn = lang === 'en';

  // Helper for localization
  const t = (en: string, de: string) => (isEn ? en : de);

  // Header
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.text('STRUCTURA AI', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(t('Construction Services & Consulting', 'Baudienstleistungen & Beratung'), 105, 26, { align: 'center' });
  doc.text('www.structura-ai.com | contact@structura-ai.com', 105, 31, { align: 'center' });

  doc.setDrawColor(200, 200, 200);
  doc.line(20, 38, 190, 38);

  // Offer Info
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(t('OFFER / PONUDA', 'ANGEBOT / PONUDA'), 20, 50);
  
  doc.setFontSize(10);
  doc.text(`${t('Date', 'Datum')}: ${new Date().toLocaleDateString()}`, 20, 58);
  doc.text(`${t('Offer ID', 'Angebots-ID')}: #${Math.floor(Math.random() * 100000)}`, 20, 63);

  // Client Info
  doc.setFontSize(12);
  doc.text(t('Project Details', 'Projektdetails'), 20, 75);
  doc.setFontSize(10);
  doc.text(`${t('Location', 'Standort')}: ${state.location || 'N/A'}`, 20, 82);
  doc.text(`${t('Service Type', 'Dienstleistungstyp')}: ${state.service_type === 'facade' ? t('Facade', 'Fassade') : t('Supporting Wall', 'Stützmauer')}`, 20, 87);

  // Table Data
  const tableRows = [];
  let totalPrice = 0;

  if (state.service_type === 'facade') {
    const area = Number(state.area) || 0;
    const logic = PRICING_LOGIC.facade;
    const materialPrice = logic.materials[state.material as keyof typeof logic.materials] || 0;
    const thicknessPrice = logic.thickness[state.thickness as keyof typeof logic.thickness] || 0;
    const scaffoldingPrice = state.scaffolding === 'yes' ? logic.scaffolding : 0;
    
    const unitPrice = logic.base + materialPrice + thicknessPrice + scaffoldingPrice;
    totalPrice = unitPrice * area;

    tableRows.push([
      t('Facade System Installation', 'Fassadensystem Installation'),
      `${area} m²`,
      `${unitPrice.toFixed(2)} €`,
      `${totalPrice.toFixed(2)} €`
    ]);
    
    tableRows.push([
      t(`Material: ${state.material}, Thickness: ${state.thickness}`, `Material: ${state.material}, Stärke: ${state.thickness}`),
      '', '', ''
    ]);
  } else if (state.service_type === 'supporting_wall') {
    const height = Number(state.height) || 0;
    const length = Number(state.length) || 0;
    const area = height * length;
    const logic = PRICING_LOGIC.supporting_wall;
    const materialPrice = logic.materials[state.material as keyof typeof logic.materials] || 0;
    const drainagePrice = state.drainage === 'yes' ? logic.drainage * length : 0;
    
    const basePrice = (logic.base + materialPrice) * area;
    totalPrice = basePrice + drainagePrice;

    tableRows.push([
      t('Supporting Wall Construction', 'Bau einer Stützmauer'),
      `${area.toFixed(2)} m²`,
      `${(logic.base + materialPrice).toFixed(2)} €/m²`,
      `${basePrice.toFixed(2)} €`
    ]);
    
    if (state.drainage === 'yes') {
      tableRows.push([
        t('Drainage System', 'Entwässerungssystem'),
        `${length} m`,
        `${logic.drainage.toFixed(2)} €/m`,
        `${drainagePrice.toFixed(2)} €`
      ]);
    }
  }

  autoTable(doc, {
    startY: 95,
    head: [[t('Description', 'Beschreibung'), t('Quantity', 'Menge'), t('Unit Price', 'Einzelpreis'), t('Total', 'Gesamt')]],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [40, 40, 40] }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(14);
  doc.text(`${t('TOTAL PRICE', 'GESAMTPREIS')}: ${totalPrice.toFixed(2)} €`, 190, finalY, { align: 'right' });

  // Footer / Terms
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(t('Terms & Conditions:', 'Allgemeine Geschäftsbedingungen:'), 20, finalY + 20);
  doc.setFontSize(8);
  const terms = t(
    '1. This offer is valid for 30 days.\n2. Prices include standard materials and labor.\n3. Final price may vary after on-site inspection.',
    '1. Dieses Angebot ist 30 Tage gültig.\n2. Die Preise beinhalten Standardmaterialien und Arbeitskraft.\n3. Der Endpreis kann nach einer Besichtigung vor Ort variieren.'
  );
  doc.text(terms, 20, finalY + 26);

  doc.save(`Offer_${state.service_type}_${new Date().getTime()}.pdf`);
};
