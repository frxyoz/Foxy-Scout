#![forbid(unsafe_code)]
pub mod clubs;
pub mod contracts;
#[cfg(feature = "desktop")]
mod desktop;
pub mod enrich;
pub mod names;
pub mod parser;
pub mod personality;
pub mod ratings;
pub mod staff;
pub mod storage;
pub mod valuation;
#[cfg(feature = "desktop")]
pub use desktop::run;
