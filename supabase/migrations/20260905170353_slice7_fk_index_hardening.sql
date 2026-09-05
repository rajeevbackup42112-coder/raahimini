-- Slice 7D: cover the payment dispute Case foreign key for advisor cleanliness.
create index idx_payment_acknowledgements_dispute_case
on public.payment_acknowledgements(dispute_case_id)
where dispute_case_id is not null;