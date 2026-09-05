export type PaymentStatus =
  | "DUE"
  | "PASSENGER_MARKED_PAID"
  | "DRIVER_CONFIRMED_RECEIVED"
  | "PAYMENT_DISPUTED";

export type FixedPaymentProjection = {
  payment_id: string;
  ride_id: string;
  booking_id: string;
  status: PaymentStatus;
  amount_inr: number;
  passenger_marked_paid_at: string | null;
  driver_confirmed_received_at: string | null;
  disputed_at: string | null;
  dispute_case_id: string | null;
};

export type DriverPaymentProjection = {
  payment_id: string;
  ride_id: string;
  status: PaymentStatus;
  amount_inr: number;
  passenger_name: string;
  origin_name: string;
  destination_name: string;
  completed_at: string | null;
};