// engram-symcc (card E2.18, ADR 0041): asks Cedar's symbolic compiler
// (cedar-policy-symcc 0.8.1, Apache-2.0, with cvc5 as its solver) whether one
// Cedar policy set implies another, for every request of one action the
// schema admits. It knows nothing of Engram's policy: the job names the
// schema, the two policy sets and the action, and the properties are written
// by tools/symcc/properties.ts over exportCedar's text.
//
// Usage: engram-symcc <job.json>
//   job:    { "schema": text, "checks": [ { "id", "action", "left", "right" } ] }
//   stdout: { "checks": [ { "id", "action", "envs", "holds", "counterexample" } ] }
// `holds` is true when every request `left` allows, `right` allows too. When
// it does not hold, `counterexample` is the request and entities the solver
// found, which Cedar's own authorizer then decides on both sets
// (`left_decision`, `right_decision`): a counterexample Cedar does not
// reproduce is reported as an error, never as a proof.
//
// cvc5 is found as cedar-policy-symcc finds it: the CVC5 environment variable
// (the absolute path of the executable), else `cvc5` on the PATH.
use std::str::FromStr;

use cedar_policy::{Authorizer, Decision, PolicySet, Schema, ValidationMode, Validator};
use cedar_policy_symcc::solver::LocalSolver;
use cedar_policy_symcc::{CedarSymCompiler, CompiledPolicySet};
use serde_json::{json, Value};

fn fail(msg: String) -> ! {
    eprintln!("engram-symcc: {msg}");
    std::process::exit(2)
}

fn text<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key)
        .and_then(Value::as_str)
        .unwrap_or_else(|| fail(format!("the job's {key} is not a string")))
}

/// Why `pset` does not compile: Cedar's strict validator on the schema, every error.
fn invalid(schema: &Schema, pset: &PolicySet) -> String {
    let result = Validator::new(schema.clone()).validate(pset, ValidationMode::Strict);
    let errors: Vec<String> = result.validation_errors().map(|e| format!("{e}")).collect();
    errors.join("; ")
}

fn decision(d: Decision) -> &'static str {
    match d {
        Decision::Allow => "allow",
        Decision::Deny => "deny",
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 2 {
        fail("usage: engram-symcc <job.json>".into());
    }
    let raw = std::fs::read_to_string(&args[1])
        .unwrap_or_else(|e| fail(format!("cannot read {}: {e}", args[1])));
    let job: Value = serde_json::from_str(&raw).unwrap_or_else(|e| fail(format!("bad job: {e}")));
    let (schema, _) = Schema::from_cedarschema_str(text(&job, "schema"))
        .unwrap_or_else(|e| fail(format!("bad schema: {e}")));
    let checks = job
        .get("checks")
        .and_then(Value::as_array)
        .unwrap_or_else(|| fail("the job has no checks".into()));
    let solver = LocalSolver::cvc5().unwrap_or_else(|e| fail(format!("cannot start cvc5: {e}")));
    let mut compiler =
        CedarSymCompiler::new(solver).unwrap_or_else(|e| fail(format!("symcc: {e}")));

    let mut out = Vec::new();
    for check in checks {
        let id = text(check, "id");
        let action = text(check, "action");
        let left = PolicySet::from_str(text(check, "left"))
            .unwrap_or_else(|e| fail(format!("{id}: bad left policy set: {e}")));
        let right = PolicySet::from_str(text(check, "right"))
            .unwrap_or_else(|e| fail(format!("{id}: bad right policy set: {e}")));
        let mut envs = 0;
        let mut counterexample = Value::Null;
        for env in schema.request_envs() {
            if env.action().id().unescaped() != action {
                continue;
            }
            envs += 1;
            let l = CompiledPolicySet::compile(&left, &env, &schema)
                .unwrap_or_else(|e| {
                    fail(format!("{id}: left does not compile: {e}: {}", invalid(&schema, &left)))
                });
            let r = CompiledPolicySet::compile(&right, &env, &schema)
                .unwrap_or_else(|e| {
                    fail(format!("{id}: right does not compile: {e}: {}", invalid(&schema, &right)))
                });
            let found = compiler
                .check_implies_with_counterexample_opt(&l, &r)
                .await
                .unwrap_or_else(|e| fail(format!("{id}: the solver failed: {e}")));
            if let Some(cex) = found {
                let auth = Authorizer::new();
                let ld = auth.is_authorized(&cex.request, &left, &cex.entities).decision();
                let rd = auth.is_authorized(&cex.request, &right, &cex.entities).decision();
                if ld != Decision::Allow || rd != Decision::Deny {
                    fail(format!(
                        "{id}: Cedar does not reproduce the counterexample (left {}, right {})",
                        decision(ld),
                        decision(rd)
                    ));
                }
                let req = &cex.request;
                let uid = |u: Option<&cedar_policy::EntityUid>| {
                    u.map(|u| json!({ "type": u.type_name().to_string(), "id": u.id().unescaped() }))
                        .unwrap_or(Value::Null)
                };
                let context = req
                    .context()
                    .map(|c| c.to_json_value().unwrap_or_else(|e| fail(format!("{id}: {e}"))))
                    .unwrap_or(Value::Null);
                let entities = cex
                    .entities
                    .to_json_value()
                    .unwrap_or_else(|e| fail(format!("{id}: {e}")));
                counterexample = json!({
                    "principal": uid(req.principal()),
                    "action": uid(req.action()),
                    "resource": uid(req.resource()),
                    "context": context,
                    "entities": entities,
                    "left_decision": decision(ld),
                    "right_decision": decision(rd),
                });
                break;
            }
        }
        if envs == 0 {
            fail(format!("{id}: the schema has no request for action {action}"));
        }
        out.push(json!({
            "id": id,
            "action": action,
            "envs": envs,
            "holds": counterexample.is_null(),
            "counterexample": counterexample,
        }));
    }
    println!("{}", json!({ "checks": out }));
}
