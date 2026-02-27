ALTER TABLE public.knowledge_items
ADD COLUMN category text;

COMMENT ON COLUMN public.knowledge_items.category IS 'Compliance domain: forms, rules-and-policies, employment-labor, medicaid, insurance, financial, documentation, tools-and-resources';
