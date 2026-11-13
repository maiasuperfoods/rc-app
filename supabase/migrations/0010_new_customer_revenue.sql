-- First-order revenue from new customers, as Triple Whale reports it. Lets NC-ROAS be read
-- rather than estimated. Null where no source supplies it (Shopify-only brands).
alter table daily_business_metrics add column if not exists new_customer_revenue numeric;
