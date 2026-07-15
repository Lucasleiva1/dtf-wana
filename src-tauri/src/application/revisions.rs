use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionConflict {
    pub code: &'static str,
    pub expected_revision: u64,
    pub current_revision: u64,
    pub recoverable: bool,
}

pub fn verify(expected: Option<u64>, current: u64) -> Result<(), RevisionConflict> {
    match expected {
        Some(value) if value != current => Err(RevisionConflict {
            code: "DOCUMENT_REVISION_CONFLICT",
            expected_revision: value,
            current_revision: current,
            recoverable: true,
        }),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_stale_revision() {
        let error = verify(Some(18), 20).unwrap_err();
        assert_eq!(error.code, "DOCUMENT_REVISION_CONFLICT");
        assert!(error.recoverable);
    }
}
