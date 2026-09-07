export type TelemetryCoverage={key:string;status:"AVAILABLE"|"GAP";detail:string};
export type OperationalMarketHealth={
 market_id:string;market_code:string;market_name:string;market_status:string;
 product_count:number;enabled_product_count:number;
 fixed_queued_requests:number;oldest_fixed_queued_at:string|null;fixed_skipped_requests:number;
 live_rides:number;exception_rides:number;overdue_rides:number;
 active_commitments:number;overdue_commitments:number;
 unresolved_cases:number;escalated_cases:number;
 payment_disputes:number;due_over_24h:number;marked_paid_over_12h:number;
 accepted_gps_samples_24h:number;worst_accepted_gps_accuracy_meters_24h:number|null;
 rejected_gps_attempts_24h:number;latest_rejected_gps_at:string|null;worst_rejected_gps_accuracy_meters_24h:number|null;
 latest_ride_event_at:string|null;latest_fixed_match_command_at:string|null;
};
export type OperationalHealthWorkspace={
 generated_at:string;can_view_global:boolean;
 thresholds:{stuck_command_minutes:number;due_payment_hours:number;marked_paid_wait_hours:number};
 global:null|{stuck_commands_over_5m:number;failed_commands_24h:number;commands_24h:number};
 telemetry_coverage:TelemetryCoverage[];markets:OperationalMarketHealth[];
};