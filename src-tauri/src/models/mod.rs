pub mod candidate;
pub mod client;
pub mod job;
pub mod stats;

use serde::{Deserialize, Deserializer};

pub use candidate::*;
pub use client::*;
pub use job::*;
pub use stats::*;

/// Distinguishes "field absent" (`None`) from "field present but null"
/// (`Some(None)`). Plain `Option<T>` collapses both to `None`, which is what
/// made a partial update wipe columns it never mentioned.
pub(crate) fn double_option<'de, T, D>(de: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Option::<T>::deserialize(de).map(Some)
}
