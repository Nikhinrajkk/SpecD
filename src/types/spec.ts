export type SpecSection = {
  id: string;
  title: string;
  body: string;
};

export type FeatureSpec = {
  title: string;
  sections: SpecSection[];
};
