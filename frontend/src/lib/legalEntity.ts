/**
 * Single place to fill in the company's legal identity.
 * Every legal page reads from here, so these values only need editing once.
 */
export const LEGAL_ENTITY = {
  name: "InfluConnect SAS",
  legalForm: "Société par actions simplifiée",
  capital: "[capital social] €",
  rcsCity: "[ville du RCS]",
  rcsNumber: "[numéro RCS]",
  siret: "[SIRET — 14 chiffres]",
  vatNumber: "[numéro de TVA intracommunautaire]",
  addressLine: "[adresse du siège social]",
  postalCode: "[code postal]",
  city: "[ville]",
  country: "France",
  email: "contact@influconnect.fr",
  phone: "[téléphone]",
  publicationDirector: "[nom du directeur de la publication]",
  hostName: "[nom de l'hébergeur]",
  hostAddress: "[adresse de l'hébergeur]",
  paymentProvider: "[prestataire de paiement]",
  mediatorName: "[nom du médiateur de la consommation]",
  mediatorUrl: "[site du médiateur]",
  lastUpdated: "1er septembre 2026",
} as const

export const fullAddress = () =>
  `${LEGAL_ENTITY.addressLine}, ${LEGAL_ENTITY.postalCode} ${LEGAL_ENTITY.city}, ${LEGAL_ENTITY.country}`
