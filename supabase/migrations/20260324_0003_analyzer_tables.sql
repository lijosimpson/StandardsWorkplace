-- Analyzer tables: NGS/IHC labs, oncology drug prescribers, open payments, medicaid utilization

-- NGS and IHC lab utilization (Medicare Part B PUF)
create table if not exists ngs_lab_utilization (
  id                              bigserial primary key,
  year                            smallint not null,
  npi                             varchar(10) not null,
  provider_last_name              text,
  provider_first_name             text,
  provider_credentials            text,
  provider_gender                 varchar(1),
  provider_entity_type            varchar(1),
  nppes_provider_street1          text,
  nppes_provider_city             text,
  nppes_provider_state            varchar(2),
  nppes_provider_zip              varchar(10),
  provider_country_code           varchar(2),
  provider_type                   text,
  medicare_participation_indicator varchar(1),
  hcpcs_code                      varchar(10) not null,
  hcpcs_description               text,
  test_category                   varchar(10) not null,  -- 'NGS', 'IHC', 'FISH'
  line_srvc_cnt                   numeric(12,2),
  bene_unique_cnt                 integer,
  bene_day_srvc_cnt               numeric(12,2),
  average_medicare_allowed_amt    numeric(12,2),
  average_submitted_chrg_amt      numeric(12,2),
  average_medicare_payment_amt    numeric(12,2),
  average_medicare_standardized_amt numeric(12,2)
);

create index if not exists idx_ngs_lab_npi on ngs_lab_utilization(npi);
create index if not exists idx_ngs_lab_hcpcs on ngs_lab_utilization(hcpcs_code);
create index if not exists idx_ngs_lab_state on ngs_lab_utilization(nppes_provider_state);
create index if not exists idx_ngs_lab_year on ngs_lab_utilization(year);
create index if not exists idx_ngs_lab_category on ngs_lab_utilization(test_category);


-- Oncology drug prescribers (Medicare Part D PUF)
create table if not exists oncology_drug_prescribers (
  id                              bigserial primary key,
  year                            smallint not null,
  npi                             varchar(10) not null,
  nppes_provider_last_org_name    text,
  nppes_provider_first_name       text,
  nppes_provider_city             text,
  nppes_provider_state            varchar(2),
  nppes_provider_zip5             varchar(5),
  nppes_credentials               text,
  provider_type                   text,
  description                     text,
  drug_name                       text not null,
  generic_name                    text,
  drug_category                   text,
  total_claim_count               integer,
  total_30_day_fill_count         numeric(12,2),
  total_day_supply                integer,
  total_drug_cost                 numeric(14,2),
  bene_count                      integer,
  total_claim_count_ge65          integer,
  total_drug_cost_ge65            numeric(14,2),
  requires_companion_dx           boolean default false,
  companion_test_type             text
);

create index if not exists idx_onc_prescriber_npi on oncology_drug_prescribers(npi);
create index if not exists idx_onc_prescriber_drug on oncology_drug_prescribers(drug_name);
create index if not exists idx_onc_prescriber_state on oncology_drug_prescribers(nppes_provider_state);
create index if not exists idx_onc_prescriber_year on oncology_drug_prescribers(year);
create index if not exists idx_onc_prescriber_companion on oncology_drug_prescribers(requires_companion_dx);


-- Open Payments / CMS Sunshine Act (filtered to oncology drugs)
create table if not exists open_payments_oncology (
  id                              bigserial primary key,
  year                            smallint not null,
  physician_npi                   varchar(10),
  physician_first_name            text,
  physician_last_name             text,
  physician_specialty             text,
  recipient_city                  text,
  recipient_state                 varchar(2),
  manufacturer_name               text,
  drug_name                       text,
  total_amount_usd                numeric(14,2),
  nature_of_payment               text,
  form_of_payment                 text,
  number_of_payments              integer,
  payment_publication_date        date
);

create index if not exists idx_open_pay_npi on open_payments_oncology(physician_npi);
create index if not exists idx_open_pay_state on open_payments_oncology(recipient_state);
create index if not exists idx_open_pay_year on open_payments_oncology(year);
create index if not exists idx_open_pay_drug on open_payments_oncology(drug_name);


-- Medicaid state-level drug utilization (aggregate)
create table if not exists medicaid_drug_utilization (
  id                              bigserial primary key,
  year                            smallint not null,
  quarter                         smallint,
  state_code                      varchar(2) not null,
  labeler_code                    varchar(10),
  product_code                    varchar(10),
  ndc                             varchar(20),
  utilization_type                varchar(10),
  suppression_used                varchar(1),
  units_reimbursed                numeric(14,2),
  number_of_prescriptions         integer,
  total_amount_reimbursed         numeric(14,2),
  medicaid_amount_reimbursed      numeric(14,2),
  non_medicaid_amount_reimbursed  numeric(14,2),
  drug_name                       text,
  drug_category                   text
);

create index if not exists idx_medicaid_state on medicaid_drug_utilization(state_code);
create index if not exists idx_medicaid_year on medicaid_drug_utilization(year);
create index if not exists idx_medicaid_ndc on medicaid_drug_utilization(ndc);
create index if not exists idx_medicaid_drug on medicaid_drug_utilization(drug_name);
