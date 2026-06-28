/** Rich hardcoded CRM dataset (DEMO ONLY) — Zoho-style modules. */

export type StageKey = "qualification" | "needs" | "proposal" | "negotiation" | "won" | "lost";
export const STAGES: { key: StageKey; label: string; prob: number; color: string }[] = [
  { key: "qualification", label: "Qualification",    prob: 10,  color: "#6b7280" },
  { key: "needs",         label: "Analyse besoins",  prob: 25,  color: "#3b82f6" },
  { key: "proposal",      label: "Proposition",      prob: 50,  color: "#8b5cf6" },
  { key: "negotiation",   label: "Négociation",      prob: 75,  color: "#f59e0b" },
  { key: "won",           label: "Gagné",            prob: 100, color: "#22c55e" },
  { key: "lost",          label: "Perdu",            prob: 0,   color: "#ef4444" },
];
export const OPEN_STAGES: StageKey[] = ["qualification", "needs", "proposal", "negotiation"];

export type LeadStatus = "Nouveau" | "Contacté" | "Qualifié" | "Non qualifié";
export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  "Nouveau": "#3b82f6", "Contacté": "#f59e0b", "Qualifié": "#22c55e", "Non qualifié": "#ef4444",
};
export const SOURCES = ["Site web", "Instagram", "Facebook Ads", "WhatsApp", "Recommandation", "Salon", "Appel entrant", "Email"] as const;
export type Source = (typeof SOURCES)[number];

export const OWNERS = ["Yacine H.", "Lina B.", "Karim S.", "Amel D."] as const;
export type Owner = (typeof OWNERS)[number];

export interface Lead {
  id: number; name: string; company: string; email: string; phone: string;
  source: Source; status: LeadStatus; score: number; owner: Owner; value: number; wilaya: string; created: string;
}
export interface Account {
  id: number; name: string; industry: string; owner: Owner; phone: string; website: string;
  wilaya: string; contacts: number; openDeals: number; revenue: number;
}
export interface CrmContact {
  id: number; name: string; title: string; account: string; email: string; phone: string; owner: Owner;
}
export interface Deal {
  id: number; name: string; account: string; contact: string; stage: StageKey;
  amount: number; owner: Owner; source: string; closeDate: string;
}
export type ActType = "Appel" | "Réunion" | "Tâche" | "Email";
export type ActStatus = "Ouverte" | "Terminée";
export interface Activity {
  id: number; type: ActType; subject: string; related: string; due: string;
  status: ActStatus; owner: Owner; priority: "Basse" | "Normale" | "Haute";
}
export type TimelineKind = "note" | "call" | "email" | "meeting" | "stage" | "created";
export interface TimelineEvt { id: number; kind: TimelineKind; text: string; who: string; when: string; }

export const LEADS: Lead[] = [
  { id: 1, name: "Sara Belkacem", company: "Boutique Zahra", email: "sara@zahra.dz", phone: "0661 20 14 88", source: "WhatsApp", status: "Nouveau", score: 82, owner: "Yacine H.", value: 180000, wilaya: "Alger", created: "2026-06-10" },
  { id: 2, name: "Mehdi Larbi", company: "TechStore DZ", email: "mehdi@techstore.dz", phone: "0770 33 21 09", source: "Instagram", status: "Contacté", score: 64, owner: "Lina B.", value: 420000, wilaya: "Oran", created: "2026-06-09" },
  { id: 3, name: "Nawel Cherif", company: "Mode & Co", email: "nawel@modeco.dz", phone: "0540 77 11 23", source: "Recommandation", status: "Qualifié", score: 91, owner: "Karim S.", value: 95000, wilaya: "Blida", created: "2026-06-08" },
  { id: 4, name: "Riad Hamdi", company: "Électro Plus", email: "riad@electroplus.dz", phone: "0541 18 60 33", source: "Salon", status: "Contacté", score: 73, owner: "Karim S.", value: 650000, wilaya: "Sétif", created: "2026-06-07" },
  { id: 5, name: "Imene Saadi", company: "Cosmétiques Yasmine", email: "imene@yasmine.dz", phone: "0663 47 09 21", source: "Facebook Ads", status: "Nouveau", score: 58, owner: "Lina B.", value: 230000, wilaya: "Constantine", created: "2026-06-07" },
  { id: 6, name: "Omar Ferhat", company: "GreenFarm Bio", email: "omar@greenfarm.dz", phone: "0771 55 12 87", source: "Appel entrant", status: "Qualifié", score: 88, owner: "Amel D.", value: 365000, wilaya: "Tizi Ouzou", created: "2026-06-06" },
  { id: 7, name: "Sofiane Méziane", company: "Auto Pièces 16", email: "sofiane@autopieces.dz", phone: "0550 90 33 47", source: "Site web", status: "Non qualifié", score: 31, owner: "Yacine H.", value: 540000, wilaya: "Alger", created: "2026-06-05" },
  { id: 8, name: "Hana Sahraoui", company: "Bébé Confort", email: "hana@bebeconfort.dz", phone: "0660 12 78 90", source: "Instagram", status: "Nouveau", score: 70, owner: "Amel D.", value: 198000, wilaya: "Oran", created: "2026-06-05" },
  { id: 9, name: "Bilal Toumi", company: "FitGear DZ", email: "bilal@fitgear.dz", phone: "0772 41 09 55", source: "Email", status: "Contacté", score: 67, owner: "Lina B.", value: 312000, wilaya: "Annaba", created: "2026-06-04" },
  { id: 10, name: "Yasmina Oulhaci", company: "Parfumerie Lys", email: "yasmina@lys.dz", phone: "0542 33 88 12", source: "Recommandation", status: "Qualifié", score: 85, owner: "Karim S.", value: 142000, wilaya: "Tlemcen", created: "2026-06-03" },
  { id: 11, name: "Adel Brahimi", company: "Maison Déco", email: "adel@maisondeco.dz", phone: "0661 09 47 21", source: "Salon", status: "Nouveau", score: 54, owner: "Yacine H.", value: 275000, wilaya: "Alger", created: "2026-06-02" },
  { id: 12, name: "Rym Belaid", company: "PharmaShop", email: "rym@pharmashop.dz", phone: "0770 88 14 06", source: "Facebook Ads", status: "Contacté", score: 76, owner: "Amel D.", value: 488000, wilaya: "Béjaïa", created: "2026-06-01" },
];

export const ACCOUNTS: Account[] = [
  { id: 1, name: "Pharma Distrib", industry: "Pharmaceutique", owner: "Yacine H.", phone: "0550 91 76 42", website: "pharmadistrib.dz", wilaya: "Alger", contacts: 4, openDeals: 2, revenue: 2400000 },
  { id: 2, name: "Électro Plus", industry: "Électronique", owner: "Karim S.", phone: "0541 18 60 33", website: "electroplus.dz", wilaya: "Sétif", contacts: 3, openDeals: 1, revenue: 1850000 },
  { id: 3, name: "GreenFarm Bio", industry: "Agroalimentaire", owner: "Amel D.", phone: "0771 55 12 87", website: "greenfarm.dz", wilaya: "Tizi Ouzou", contacts: 2, openDeals: 1, revenue: 980000 },
  { id: 4, name: "TechStore DZ", industry: "High-tech", owner: "Lina B.", phone: "0770 33 21 09", website: "techstore.dz", wilaya: "Oran", contacts: 5, openDeals: 3, revenue: 3120000 },
  { id: 5, name: "Maison Déco", industry: "Ameublement", owner: "Yacine H.", phone: "0661 09 47 21", website: "maisondeco.dz", wilaya: "Alger", contacts: 2, openDeals: 1, revenue: 760000 },
  { id: 6, name: "Cosmétiques Yasmine", industry: "Cosmétique", owner: "Lina B.", phone: "0663 47 09 21", website: "yasmine.dz", wilaya: "Constantine", contacts: 3, openDeals: 2, revenue: 1340000 },
  { id: 7, name: "Sport Center Oran", industry: "Sport & Loisirs", owner: "Karim S.", phone: "0541 70 22 18", website: "sportcenter.dz", wilaya: "Oran", contacts: 2, openDeals: 1, revenue: 540000 },
  { id: 8, name: "Bébé Confort", industry: "Puériculture", owner: "Amel D.", phone: "0660 12 78 90", website: "bebeconfort.dz", wilaya: "Oran", contacts: 1, openDeals: 1, revenue: 420000 },
];

export const CONTACTS: CrmContact[] = [
  { id: 1, name: "Dr. Amel Khaldi", title: "Directrice Achats", account: "Pharma Distrib", email: "a.khaldi@pharmadistrib.dz", phone: "0550 91 76 42", owner: "Yacine H." },
  { id: 2, name: "Riad Hamdi", title: "Gérant", account: "Électro Plus", email: "riad@electroplus.dz", phone: "0541 18 60 33", owner: "Karim S." },
  { id: 3, name: "Omar Ferhat", title: "Co-fondateur", account: "GreenFarm Bio", email: "omar@greenfarm.dz", phone: "0771 55 12 87", owner: "Amel D." },
  { id: 4, name: "Mehdi Larbi", title: "Responsable e-commerce", account: "TechStore DZ", email: "mehdi@techstore.dz", phone: "0770 33 21 09", owner: "Lina B." },
  { id: 5, name: "Sonia Belkadi", title: "Acheteuse", account: "TechStore DZ", email: "sonia@techstore.dz", phone: "0770 41 22 18", owner: "Lina B." },
  { id: 6, name: "Adel Brahimi", title: "Propriétaire", account: "Maison Déco", email: "adel@maisondeco.dz", phone: "0661 09 47 21", owner: "Yacine H." },
  { id: 7, name: "Imene Saadi", title: "Responsable Marketing", account: "Cosmétiques Yasmine", email: "imene@yasmine.dz", phone: "0663 47 09 21", owner: "Lina B." },
  { id: 8, name: "Karim Benali", title: "Gérant", account: "Sport Center Oran", email: "karim@sportcenter.dz", phone: "0541 70 22 18", owner: "Karim S." },
];

export const DEALS: Deal[] = [
  // negotiation (2)
  { id: 1, name: "Contrat livraison annuel", account: "Pharma Distrib", contact: "Dr. Amel Khaldi", stage: "negotiation", amount: 880000, owner: "Yacine H.", source: "Direct", closeDate: "2026-06-25" },
  { id: 6, name: "Renouvellement contrat", account: "Maison Déco", contact: "Adel Brahimi", stage: "negotiation", amount: 275000, owner: "Yacine H.", source: "Site web", closeDate: "2026-06-22" },
  // proposal (3)
  { id: 2, name: "Pack e-commerce Pro", account: "TechStore DZ", contact: "Mehdi Larbi", stage: "proposal", amount: 420000, owner: "Lina B.", source: "Instagram", closeDate: "2026-06-30" },
  { id: 5, name: "Déploiement national", account: "Cosmétiques Yasmine", contact: "Imene Saadi", stage: "proposal", amount: 230000, owner: "Lina B.", source: "Facebook Ads", closeDate: "2026-06-28" },
  { id: 13, name: "Intégration marketplace", account: "TechStore DZ", contact: "Sonia Belkadi", stage: "proposal", amount: 512000, owner: "Lina B.", source: "Direct", closeDate: "2026-07-02" },
  // needs (2)
  { id: 3, name: "Abonnement volume", account: "Électro Plus", contact: "Riad Hamdi", stage: "needs", amount: 650000, owner: "Karim S.", source: "Salon", closeDate: "2026-07-05" },
  { id: 16, name: "Renouvellement saisonnier", account: "Sport Center Oran", contact: "Karim Benali", stage: "needs", amount: 184000, owner: "Karim S.", source: "Recommandation", closeDate: "2026-07-08" },
  // qualification (4)
  { id: 4, name: "Livraison Bio hebdo", account: "GreenFarm Bio", contact: "Omar Ferhat", stage: "qualification", amount: 365000, owner: "Amel D.", source: "Appel entrant", closeDate: "2026-07-10" },
  { id: 7, name: "Pack starter", account: "Sport Center Oran", contact: "Karim Benali", stage: "qualification", amount: 310000, owner: "Karim S.", source: "Pub Facebook", closeDate: "2026-07-12" },
  { id: 11, name: "Lancement gamme parfum", account: "Cosmétiques Yasmine", contact: "Imene Saadi", stage: "qualification", amount: 175000, owner: "Lina B.", source: "Site web", closeDate: "2026-07-15" },
  { id: 12, name: "Extension SAV régional", account: "Électro Plus", contact: "Riad Hamdi", stage: "qualification", amount: 96500, owner: "Karim S.", source: "Salon", closeDate: "2026-07-18" },
  // won (4)
  { id: 8, name: "Contrat puériculture", account: "Bébé Confort", contact: "Hana Sahraoui", stage: "won", amount: 198000, owner: "Amel D.", source: "Instagram", closeDate: "2026-06-08" },
  { id: 9, name: "Pilote logistique", account: "TechStore DZ", contact: "Sonia Belkadi", stage: "won", amount: 540000, owner: "Lina B.", source: "Direct", closeDate: "2026-06-05" },
  { id: 14, name: "Contrat trimestriel", account: "GreenFarm Bio", contact: "Omar Ferhat", stage: "won", amount: 286000, owner: "Amel D.", source: "Appel entrant", closeDate: "2026-06-03" },
  { id: 15, name: "Showroom Oran", account: "Maison Déco", contact: "Adel Brahimi", stage: "won", amount: 332500, owner: "Yacine H.", source: "Salon", closeDate: "2026-05-30" },
  // lost (1)
  { id: 10, name: "Offre saisonnière", account: "Pharma Distrib", contact: "Dr. Amel Khaldi", stage: "lost", amount: 120000, owner: "Yacine H.", source: "Email", closeDate: "2026-05-28" },
];

export const ACTIVITIES: Activity[] = [
  { id: 1, type: "Appel", subject: "Relancer pour la proposition", related: "TechStore DZ — Pack e-commerce Pro", due: "2026-06-11", status: "Ouverte", owner: "Lina B.", priority: "Haute" },
  { id: 2, type: "Réunion", subject: "Démo produit chez le client", related: "Maison Déco — Renouvellement", due: "2026-06-12", status: "Ouverte", owner: "Yacine H.", priority: "Normale" },
  { id: 3, type: "Email", subject: "Envoyer le devis détaillé", related: "Électro Plus — Abonnement volume", due: "2026-06-11", status: "Ouverte", owner: "Karim S.", priority: "Haute" },
  { id: 4, type: "Tâche", subject: "Préparer contrat annuel", related: "Pharma Distrib — Contrat livraison", due: "2026-06-13", status: "Ouverte", owner: "Yacine H.", priority: "Haute" },
  { id: 5, type: "Appel", subject: "Qualifier le lead", related: "GreenFarm Bio", due: "2026-06-10", status: "Terminée", owner: "Amel D.", priority: "Normale" },
  { id: 6, type: "Réunion", subject: "Point hebdomadaire équipe", related: "Interne", due: "2026-06-14", status: "Ouverte", owner: "Lina B.", priority: "Basse" },
  { id: 7, type: "Email", subject: "Relance facture", related: "Sport Center Oran", due: "2026-06-09", status: "Terminée", owner: "Karim S.", priority: "Normale" },
  { id: 8, type: "Tâche", subject: "Mettre à jour la fiche compte", related: "Cosmétiques Yasmine", due: "2026-06-15", status: "Ouverte", owner: "Lina B.", priority: "Basse" },
  { id: 9, type: "Appel", subject: "Négocier remise volume", related: "Pharma Distrib — Contrat livraison", due: "2026-06-12", status: "Ouverte", owner: "Yacine H.", priority: "Haute" },
];

export const TIMELINE: Record<string, TimelineEvt[]> = {
  "Pharma Distrib": [
    { id: 1, kind: "stage", text: "Affaire passée en Négociation", who: "Yacine H.", when: "il y a 1j" },
    { id: 2, kind: "call", text: "Appel avec Dr. Khaldi — intéressée par le volume", who: "Yacine H.", when: "il y a 2j" },
    { id: 3, kind: "email", text: "Proposition commerciale envoyée", who: "Yacine H.", when: "il y a 4j" },
    { id: 4, kind: "note", text: "Budget confirmé : ~900k DA/an", who: "Yacine H.", when: "il y a 5j" },
    { id: 5, kind: "created", text: "Compte créé", who: "Yacine H.", when: "il y a 12j" },
  ],
};

export const MONTHLY_REVENUE = [
  { m: "Jan", v: 1240000 }, { m: "Fév", v: 1580000 }, { m: "Mar", v: 1320000 },
  { m: "Avr", v: 1920000 }, { m: "Mai", v: 2140000 }, { m: "Juin", v: 1680000 },
];

/* ── Omnichannel (WhatsApp / Facebook / Instagram) ── */
export type Channel = "whatsapp" | "facebook" | "instagram";
export const CHANNELS: { key: Channel; label: string; handle: string; color: string; connected: boolean; unread: number; convos: number }[] = [
  { key: "whatsapp",  label: "WhatsApp Business",  handle: "+213 770 11 22 33",        color: "#25D366", connected: true, unread: 5, convos: 18 },
  { key: "facebook",  label: "Facebook Messenger", handle: "Livraison Express DZ",     color: "#1877F2", connected: true, unread: 3, convos: 11 },
  { key: "instagram", label: "Instagram Direct",   handle: "@livraison.express.dz",    color: "#E1306C", connected: true, unread: 7, convos: 24 },
];

export interface ChatMsg { from: "them" | "me"; text: string; time: string; }
export interface Convo { id: number; channel: Channel; name: string; handle: string; last: string; time: string; unread: number; messages: ChatMsg[]; }
export const CONVERSATIONS: Convo[] = [
  { id: 1, channel: "whatsapp", name: "Sara Belkacem", handle: "+213 661 20 14 88", last: "Bonjour, je voudrais un devis pour ~200 colis/mois", time: "09:41", unread: 2,
    messages: [
      { from: "them", text: "Bonjour 👋", time: "09:38" },
      { from: "them", text: "Je gère la Boutique Zahra à Alger", time: "09:39" },
      { from: "them", text: "Je voudrais un devis pour ~200 colis/mois", time: "09:41" },
    ] },
  { id: 2, channel: "instagram", name: "Yasmina Oulhaci", handle: "@parfumerie.lys", last: "Vous livrez jusqu'à Tlemcen ?", time: "09:12", unread: 1,
    messages: [
      { from: "them", text: "Salam, vous livrez jusqu'à Tlemcen ?", time: "09:10" },
      { from: "me", text: "Bonjour ! Oui, Tlemcen est couverte — domicile et stop desk 🙂", time: "09:11" },
      { from: "them", text: "Super, c'est quoi le délai ?", time: "09:12" },
    ] },
  { id: 3, channel: "facebook", name: "Riad Hamdi", handle: "Électro Plus", last: "Quels délais pour Sétif ?", time: "Hier", unread: 0,
    messages: [
      { from: "them", text: "Bonjour, quels sont vos délais pour Sétif ?", time: "Hier 16:20" },
      { from: "me", text: "48–72h en moyenne pour Sétif.", time: "Hier 16:35" },
    ] },
  { id: 4, channel: "whatsapp", name: "Hana Sahraoui", handle: "+213 660 12 78 90", last: "Merci, le colis est bien arrivé 🙏", time: "Hier", unread: 0,
    messages: [
      { from: "them", text: "Le colis est bien arrivé, merci 🙏", time: "Hier 14:02" },
      { from: "me", text: "Avec plaisir Hana ! 🙌", time: "Hier 14:05" },
    ] },
  { id: 5, channel: "instagram", name: "Imene Saadi", handle: "@cosmetiques.yasmine", last: "Je veux activer le paiement à la livraison", time: "08:50", unread: 3,
    messages: [
      { from: "them", text: "Bonjour, je veux activer le paiement à la livraison (COD)", time: "08:48" },
      { from: "them", text: "Et aussi voir vos tarifs vers Constantine", time: "08:49" },
      { from: "them", text: "Vous avez une API ?", time: "08:50" },
    ] },
  { id: 6, channel: "whatsapp", name: "Bilal Toumi", handle: "+213 772 41 09 55", last: "C'est combien vers Annaba ?", time: "08:30", unread: 1,
    messages: [
      { from: "them", text: "C'est combien la livraison vers Annaba ?", time: "08:30" },
    ] },
  { id: 7, channel: "facebook", name: "Adel Brahimi", handle: "Maison Déco", last: "On peut programmer un ramassage demain ?", time: "Lun", unread: 0,
    messages: [
      { from: "them", text: "On peut programmer un ramassage demain matin ?", time: "Lun 11:10" },
      { from: "me", text: "Oui, je vous envoie un livreur entre 9h et 11h 👍", time: "Lun 11:22" },
    ] },
  { id: 8, channel: "instagram", name: "Rym Belaid", handle: "@pharmashop.dz", last: "Avez-vous une intégration Shopify ?", time: "Lun", unread: 2,
    messages: [
      { from: "them", text: "Avez-vous une intégration Shopify / WooCommerce ?", time: "Lun 10:02" },
      { from: "them", text: "Je veux que les commandes créent les colis automatiquement", time: "Lun 10:03" },
    ] },
];
