/**
 * Optional, Admin-managed product master content.
 * Do not invent values or publish unverified claims. Zero values provided
 * will render "Not provided yet" until approved Admin content is available.
 * Search-only metadata is retained here for a future server-side SEO/API bridge,
 * not printed as customer product claims.
 */
export type ProductContent={
 descriptionEn?:string;descriptionBn?:string;
 manufacturer?:string;originCountry?:string;
 ingredientsEn?:string;ingredientsBn?:string;
 allergensEn?:string;allergensBn?:string;
 storageEn?:string;storageBn?:string;
 shelfLife?:string;certifications?:string;
 faqQuestionEn?:string;faqQuestionBn?:string;
 faqAnswerEn?:string;faqAnswerBn?:string;
 serviceAreasEn?:string;serviceAreasBn?:string;
 deliveryEn?:string;deliveryBn?:string;
 localAvailabilityEn?:string;localAvailabilityBn?:string;
 seoTitleEn?:string;seoTitleBn?:string;
 seoDescriptionEn?:string;seoDescriptionBn?:string;
 slug?:string;canonicalUrl?:string;
 imageAltEn?:string;imageAltBn?:string;
 structuredDataStatus?:string;
};
export type TextField=Exclude<keyof ProductContent,"structuredDataStatus">;
export type InfoSection={id:'seo'|'aeo'|'geo';titleEn:string;titleBn:string;fields:ReadonlyArray<{keyEn:TextField;keyBn?:TextField;labelEn:string;labelBn:string}>};
export const productInfoSections:ReadonlyArray<InfoSection>=[
 {id:'seo',titleEn:'Description & specifications (SEO)',titleBn:'বিবরণ ও বৈশিষ্ট্য (SEO)',fields:[
  {keyEn:'descriptionEn',keyBn:'descriptionBn',labelEn:'Product description',labelBn:'পণ্যের বিবরণ'},
  {keyEn:'manufacturer',labelEn:'Manufacturer',labelBn:'উৎপাদনকারী'},
  {keyEn:'originCountry',labelEn:'Country of origin',labelBn:'উৎপত্তির দেশ'},
  {keyEn:'ingredientsEn',keyBn:'ingredientsBn',labelEn:'Ingredients / materials',labelBn:'উপাদান'},
  {keyEn:'allergensEn',keyBn:'allergensBn',labelEn:'Allergen information',labelBn:'অ্যালার্জি তথ্য'},
  {keyEn:'storageEn',keyBn:'storageBn',labelEn:'Storage instructions',labelBn:'সংরক্ষণের নির্দেশনা'},
  {keyEn:'shelfLife',labelEn:'Shelf life / best before',labelBn:'সংরক্ষণকাল / মেয়াদ'},
  {keyEn:'certifications',labelEn:'Verified certification',labelBn:'যাচাইকৃত সনদ'}]},
 {id:'aeo',titleEn:'Questions & answers (AEO)',titleBn:'প্রশ্ন ও উত্তর (AEO)',fields:[
  {keyEn:'faqQuestionEn',keyBn:'faqQuestionBn',labelEn:'Frequently asked question',labelBn:'প্রায়শই জিজ্ঞাসিত প্রশ্ন'},
  {keyEn:'faqAnswerEn',keyBn:'faqAnswerBn',labelEn:'Verified answer',labelBn:'যাচাইকৃত উত্তর'}]},
 {id:'geo',titleEn:'Local availability (GEO)',titleBn:'এলাকাভিত্তিক প্রাপ্যতা (GEO)',fields:[
  {keyEn:'serviceAreasEn',keyBn:'serviceAreasBn',labelEn:'Available areas',labelBn:'যেসব এলাকায় পাওয়া যায়'},
  {keyEn:'deliveryEn',keyBn:'deliveryBn',labelEn:'Delivery / pickup',labelBn:'ডেলিভারি / সংগ্রহ'},
  {keyEn:'localAvailabilityEn',keyBn:'localAvailabilityBn',labelEn:'Local availability note',labelBn:'স্থানীয় প্রাপ্যতার তথ্য'}]}
] as const;
export const productMissing=(value:unknown,language:'en'|'bn')=>
 typeof value==='string'&&value.trim()?value.trim():language==='bn'?'এখনো দেওয়া হয়নি':'Not provided yet';
