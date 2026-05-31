# Interview Prep — with Java Backend Alternatives

> Companion to [INTERVIEW_PREP.md](./INTERVIEW_PREP.md) and
> [INTERVIEW_PLAYBOOK.md](./INTERVIEW_PLAYBOOK.md). For every backend concept,
> decision, and snippet in those docs, this maps the **Java / Spring Boot
> equivalent** — so you can present the *same project* whether the interviewer's
> stack is Node or Java.

**The one framing rule:** the **Angular frontend does not change.** NgRx, signals,
reactive forms, the HTTP interceptors, lazy loading, the async unique-email
validator on the client — all identical regardless of backend language. **Only
the server changes.** So when an interviewer says "we're a Java shop," your answer
is: *"The entire Angular half is unchanged; here's how I'd build the same layered
backend in Spring Boot."*

> ⚠️ **Accuracy note:** the project is **not** written in Java — this doc is a
> translation guide for interview conversations, not a description of code in the
> repo. APIs named below (Spring Boot 3 / Jakarta EE) are current as of the
> knowledge cutoff; verify versions before quoting them as gospel.

---

## Table of contents

1. [The stack swap at a glance](#1-the-stack-swap-at-a-glance)
2. [Layer-by-layer: Express MVC → Spring Boot](#2-layer-by-layer-express-mvc--spring-boot)
3. [Concept-by-concept mapping](#3-concept-by-concept-mapping)
4. [The hero snippets, rewritten in Java](#4-the-hero-snippets-rewritten-in-java)
5. [Testing: Jest/supertest → JUnit/MockMvc](#5-testing-jestsupertest--junitmockmvc)
6. [Scaling 10x — the Java answers](#6-scaling-10x--the-java-answers)
7. [The concurrency-model talking point (event loop vs thread pool)](#7-the-concurrency-model-talking-point-event-loop-vs-thread-pool)
8. [How the demo changes (and what doesn't)](#8-how-the-demo-changes-and-what-doesnt)
9. [Glossary of Java/Spring terms](#9-glossary-of-javaspring-terms)

---

## 1. The stack swap at a glance

| Concern | This project (Node/Express) | Java / Spring Boot equivalent |
|---|---|---|
| Language / runtime | JavaScript on Node.js | Java on the JVM |
| Web framework | Express | Spring Boot (Spring MVC) — or Spring WebFlux for reactive |
| Build / run | npm, `node server.js` | Maven (`mvn spring-boot:run`) or Gradle (`./gradlew bootRun`); ship a `java -jar app.jar` |
| Dependency injection | Manual `require()` wiring | Spring IoC container — constructor injection, `@Component`/`@Service`/`@Repository`/`@RestController` |
| Routing | `express.Router()` + `router.get(...)` | `@RestController` + `@GetMapping/@PostMapping/...` |
| Validation | Hand-rolled `{field,message}[]` (or zod/joi) | **Jakarta Bean Validation** (`@NotBlank`, `@Email`, …) via Hibernate Validator + custom `ConstraintValidator` |
| Error format | `problem-details.js` (RFC 7807) | Spring's built-in `ProblemDetail` + `@ControllerAdvice` |
| Persistence | In-memory arrays in `store.js` | Spring Data JPA + Hibernate (H2 in-memory for dev, Postgres for real) |
| Config | `config/index.js` | `application.yml` + `@ConfigurationProperties` |
| Logging | morgan + `console.log` | SLF4J + Logback (Boot default) |
| Correlation id | Express middleware + header | Servlet `Filter` + **SLF4J MDC** |
| Ids | `uuid` package | `java.util.UUID.randomUUID()` |
| Auth (the gap) | none | Spring Security (`spring-boot-starter-oauth2-resource-server` for JWT) |

---

## 2. Layer-by-layer: Express MVC → Spring Boot

The playbook's architecture diagram has five backend layers. Each maps cleanly:

| Express layer | What it does | Spring Boot equivalent |
|---|---|---|
| **Routes** (`routes/*.js`) | URL → controller wiring | Annotations *on* the controller: `@RequestMapping("/api/employees")` + `@GetMapping`, etc. (no separate routes file) |
| **Controllers** (`controllers/*.js`) | HTTP shape only: status codes, parse, dispatch | `@RestController` classes; methods return `ResponseEntity<T>` or the body directly |
| **Validators** (`validators/*.js`) | Return `{field,message}[]` | Bean Validation annotations on the request DTO + `@Valid`; custom rules via `ConstraintValidator` |
| **Services** (`services/*.js`) | Business rules, audit, orchestration | `@Service` classes; `@Transactional` for the cascade-delete "transaction-shaped" function |
| **Repositories** (`repositories/*.js`) | Pure CRUD against the store | `interface ... extends JpaRepository<Employee, UUID>` — Spring generates the implementation |
| **In-memory store** (`store.js`) | The data | A database via JPA; H2 for dev/tests, Postgres for production |

**The senior point survives the translation:** the reason for the layering — keeping
business rules testable in isolation from HTTP and from data access — is *exactly*
the same argument Spring developers make for the `@Controller`/`@Service`/`@Repository`
stereotype split. You're not learning a new philosophy, just new annotations.

---

## 3. Concept-by-concept mapping

### 3a. Validation — the headline example

- **Here:** hand-rolled pure-function validators (the playbook notes zod/joi as the heavier alternative we declined).
- **Java:** **Jakarta Bean Validation** (spec, JSR 380) with **Hibernate Validator** as the implementation — this is the idiomatic, near-universal choice, the Java analogue of zod/joi.

You annotate a **DTO** (Data Transfer Object) and let the framework validate it:

```java
public record EmployeeCreateRequest(
    @NotBlank @Size(min = 2, max = 60) @Pattern(regexp = "[\\p{L} '-]+") String firstName,
    @NotBlank @Size(min = 2, max = 60) @Pattern(regexp = "[\\p{L} '-]+") String lastName,
    @NotBlank @Email @Size(max = 120) String email,
    @NotNull EmployeeRole role,
    EmployeeStatus status
) {}
```

```java
@PostMapping
public ResponseEntity<EmployeeResponse> create(@Valid @RequestBody EmployeeCreateRequest req) { ... }
```

`@Valid` triggers validation; a failure throws `MethodArgumentNotValidException`,
which you translate to a problem-details response (see 3b). For rules annotations
can't express (the **async unique-email** check that hits the DB), you write a
**custom `ConstraintValidator`** *or* — more commonly — do it in the service and
back it with a **`UNIQUE` constraint** on the column:

```java
public boolean isEmailAvailable(String email, UUID excludeId) {
    return employeeRepository.findByEmailIgnoreCase(email.trim())
        .filter(e -> !e.getId().equals(excludeId))
        .isEmpty();
}
```

> Note: `findByEmailIgnoreCase` is a **derived query** — Spring Data generates the
> SQL from the method name. That's the Java equivalent of our repository's
> `findByEmail` with `toLowerCase()`.

### 3b. Problem-details errors

- **Here:** `utils/problem-details.js` builds RFC 7807 objects; controllers return them with the right status.
- **Java:** Spring 6 / Boot 3 ship a first-class **`ProblemDetail`** class *and* RFC 7807 support out of the box (`spring.mvc.problemdetails.enabled=true`). Centralise translation in a **`@ControllerAdvice`**:

```java
@ControllerAdvice
class ApiExceptionHandler extends ResponseEntityExceptionHandler {
    @ExceptionHandler(EmailInUseException.class)
    ProblemDetail handleConflict(EmailInUseException ex) {
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Email is already in use");
        pd.setTitle("Conflict");
        return pd; // serialises to the same shape as our problem() helper
    }
}
```

`@ControllerAdvice` is the Java equivalent of having one error helper used
everywhere — but it's *centralised interception* rather than each controller
calling a helper. Cleaner, and it also catches the framework's own exceptions
(validation, 404, etc.) in one place.

### 3c. Input sanitisation

- **Here:** `sanitize.js` strips HTML tags and trims.
- **Java:** the **OWASP Java HTML Sanitizer** (or Jsoup's `Jsoup.clean(...)`) for HTML stripping; trimming via a custom Jackson deserializer or simply in the DTO/service. In practice Java apps lean harder on the typed boundary + Bean Validation, and reserve HTML sanitisation for fields that genuinely render as HTML.

### 3d. Dependency injection

- **Here:** Angular uses `inject()`; Express wires modules by `require()` manually.
- **Java:** Spring's **IoC container** does it. Idiomatic style is **constructor injection** (no `@Autowired` needed on a single constructor):

```java
@Service
public class EmployeeService {
    private final EmployeeRepository employees;
    private final AccountRepository accounts;
    private final AuditService audit;
    public EmployeeService(EmployeeRepository e, AccountRepository a, AuditService au) {
        this.employees = e; this.accounts = a; this.audit = au;
    }
}
```

This is conceptually identical to Angular's DI (which the interviewer will know
you used on the frontend) — same "declare what you depend on, the framework
provides it" idea, different container.

### 3e. Correlation-id + logging

- **Here:** Express middleware mints/echoes `X-Correlation-Id`; morgan stamps each log line; the client interceptor sets it.
- **Java:** a **`OncePerRequestFilter`** reads/mints the header and puts it in **MDC** (Mapped Diagnostic Context — SLF4J's per-thread key/value bag). Logback's pattern then prints it on every line automatically:

```java
public class CorrelationIdFilter extends OncePerRequestFilter {
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
        throws ... {
        String cid = Optional.ofNullable(req.getHeader("X-Correlation-Id"))
            .orElse(UUID.randomUUID().toString());
        MDC.put("correlationId", cid);
        res.setHeader("X-Correlation-Id", cid);
        try { chain.doFilter(req, res); } finally { MDC.clear(); }
    }
}
```

```
# logback pattern
%d %-5level [%X{correlationId}] %logger - %msg%n
```

The **Angular client interceptor is unchanged** — it still mints the header; the
Java filter just reads it on the other end. This is a great moment to say *"the
contract is the HTTP header, so the frontend doesn't care what language answers."*

### 3f. The audit log (append-only, diff for UPDATE)

This is the richest mapping. Three Java options, increasing in power:

| Approach | What you get | When |
|---|---|---|
| **Spring Data JPA auditing** (`@CreatedDate`, `@LastModifiedDate`, `@CreatedBy`, `@EntityListeners(AuditingEntityListener.class)`) | Automatic timestamp/actor stamping on entities | The `createdAt`/`updatedAt` fields — the easy 80% |
| **Hibernate Envers** (`@Audited`) | Automatic full revision history in `_AUD` tables — every change versioned, queryable | The append-only change log "for free" |
| **Axon Framework / event store** | True event sourcing + CQRS | The 10x answer (see §6) |

Our hand-rolled diff (`{field, before, after}`) maps most directly to **Hibernate
Envers**, which versions each row and lets you query "what did this entity look
like at revision N" — the same compliance capability, generated by the framework
instead of written by hand. In an interview: *"I hand-rolled the diff to keep it
visible and dependency-free; in Spring I'd reach for Envers, which gives the same
append-only history declaratively."*

### 3g. Soft delete + cascade

- **Here:** `DELETE /accounts/:id` flips status to CLOSED; deleting an employee cascades a soft-close of their open accounts, in the service's `remove()`.
- **Java:**
  - **Soft delete:** Hibernate `@SQLDelete` + `@SQLRestriction` (formerly `@Where`), or the newer `@SoftDelete` annotation (Hibernate 6.4+) — turns a `DELETE` into an `UPDATE status = CLOSED` automatically.
  - **Cascade:** JPA relationship cascade — `@OneToMany(mappedBy="employee", cascade = CascadeType.ALL)`.
  - **The orchestration** (delete employee + close open accounts + write audit entries) lives in a `@Service` method marked **`@Transactional`**, so it's atomic — the database-level guarantee our in-memory version only *approximates*.

### 3h. Pagination + the MAX_PAGE_SIZE clamp

- **Here:** `list()` clamps `size` to `MAX_PAGE_SIZE = 100` with `Math.min(...)` and echoes the clamped value.
- **Java:** **Spring Data `Pageable`** is built for this. A controller takes a `Pageable` and returns a `Page<EmployeeResponse>` (which includes total count, page, size — same envelope we hand-build). The clamp is a config property:

```yaml
spring.data.web.pageable.max-page-size: 100   # requests above this are capped
```

```java
@GetMapping
public Page<EmployeeResponse> list(
    @RequestParam(required=false) String search,
    Pageable pageable) { ... }   // ?page=0&size=10&sort=lastName,asc
```

So the hardening we wrote by hand is a one-line setting in Spring — worth saying:
*"the clamp is a config property in Spring Data; I implemented it manually here to
make the security rationale explicit."*

---

## 4. The hero snippets, rewritten in Java

### 4a. Cascade delete + audit (the backend showpiece)

Express version is in [INTERVIEW_PREP.md §5a](./INTERVIEW_PREP.md#5a-the-backends-best-moment--cascade-delete--audit). Java:

```java
@Service
public class EmployeeService {
    // ... constructor injection ...

    @Transactional
    public boolean remove(UUID employeeId, AuditContext ctx) {
        Employee employee = employees.findById(employeeId).orElse(null);
        if (employee == null) return false;

        List<Account> toClose = accounts.findByEmployeeIdAndStatus(employeeId, OPEN);

        employees.delete(employee);                       // soft or hard per policy
        accounts.closeAllByEmployeeId(employeeId);        // bulk UPDATE status = CLOSED

        audit.recordEmployeeDeleted(employee, ctx);
        toClose.forEach(a -> audit.recordAccountCascadeClosed(a, ctx));
        return true;
    }
}
```

**Say:** *"Same cohesive business operation. The big upgrade Java gives me here is
`@Transactional` — the whole cascade commits or rolls back atomically against the
database. My in-memory version had to be careful about ordering because there was
no real transaction; JPA makes it a hard guarantee."* That's a genuinely
*stronger* version of the same answer.

### 4b. Validation (the zod/joi → Bean Validation line)

Already shown in [3a](#3a-validation--the-headline-example). The talking point:
*"On the client I use Angular reactive-form validators; on an Express backend I
hand-rolled the rules; in Spring I'd use Jakarta Bean Validation with Hibernate
Validator — declarative annotations on the DTO, with a custom `ConstraintValidator`
for the unique-email check. Same defence-in-depth: validate on both client and
server."*

### 4c. The async unique-email endpoint

The Angular async validator is unchanged. The endpoint it calls becomes:

```java
@GetMapping("/email-available")
public Map<String, Boolean> emailAvailable(@RequestParam String email,
                                            @RequestParam(required=false) UUID excludeId) {
    return Map.of("available", service.isEmailAvailable(email, excludeId));
}
```

Same `{ "available": boolean }` contract → the Angular validator can't tell the
difference. (And the whitespace-trim fix we made applies identically — `email.trim()`.)

---

## 5. Testing: Jest/supertest → JUnit/MockMvc

| This project | Java equivalent |
|---|---|
| Jest (backend unit) | **JUnit 5** (Jupiter) + **Mockito** (mocking) + **AssertJ** (fluent assertions) |
| Service unit test with stubbed repo | `@ExtendWith(MockitoExtension.class)`, `@Mock` the repository, `@InjectMocks` the service — the exact pattern as our cascade-delete test |
| supertest / HTTP-level test | **`@WebMvcTest` + `MockMvc`** (controller slice) or **`@SpringBootTest`** (full context); **REST Assured** as an alternative |
| In-memory store reset between tests (`resetStore()`) | `@DirtiesContext`, an in-memory **H2** rolled back per test, or **Testcontainers** spinning a real Postgres in Docker for high-fidelity tests |
| Cypress e2e | **Unchanged** — it drives the browser, backend language is irrelevant |

The senior framing carries over verbatim: *"I'd concentrate tests on the two
services where a regression silently corrupts data — same risk-based strategy,
just JUnit + Mockito instead of Jest."*

---

## 6. Scaling 10x — the Java answers

Mapping [HOW_WOULD_YOU_SCALE_THIS_10X.md](./HOW_WOULD_YOU_SCALE_THIS_10X.md):

| Bottleneck | Node answer | Java / Spring answer |
|---|---|---|
| In-memory store | Postgres + targeted indexes | Same Postgres; declare indexes with JPA `@Table(indexes = @Index(...))` and `@Column(unique=true)`; Spring Data repositories stay the only layer that changes |
| Audit log growth | Event sourcing + Redis read model | **Axon Framework** (purpose-built event sourcing/CQRS on the JVM) or an event table; **Spring Data Redis** for the read model / `@Cacheable` |
| Single process | Horizontal scale behind LB | Identical — a **stateless** Spring Boot app scales out behind a load balancer once state is in Postgres; Spring Session (Redis-backed) if you do have sessions |
| Full-list work per filter | Server-side pagination + CDN | `Pageable`/`Page` already bounds payloads; HTTP caching via `ResponseEntity` + `CacheControl`; CDN identical |
| No tracing | OpenTelemetry off correlation-id | **Micrometer Tracing** (Boot 3) bridged to OpenTelemetry, or the **OTel Java agent** (zero-code instrumentation); MDC correlation-id becomes the trace/span context |
| First-load bundle | Lazy loading | **Frontend — unchanged** (still Angular) |

The dependency chain is the same in both worlds: **a shared database unlocks
stateless horizontal scaling.** That insight is language-agnostic — which is
exactly why it impresses.

---

## 7. The concurrency-model talking point (event loop vs thread pool)

This is the one place the languages genuinely differ, and naming it is a strong
senior signal:

- **Node/Express:** a **single-threaded event loop** with non-blocking I/O. One thread juggles thousands of concurrent connections by never blocking on I/O. CPU-bound work blocks everyone, so you offload it.
- **Spring MVC (traditional):** **thread-per-request** on a servlet container (Tomcat). Each request gets a thread from a pool; blocking I/O is fine because other threads keep serving. Simpler mental model; memory cost per thread caps concurrency.
- **Spring WebFlux (reactive):** non-blocking on **Netty** with an event-loop model — **conceptually the closest to Node**. You'd reach for it for very high concurrency with mostly-I/O workloads.

How to say it: *"Node's event loop maps most closely to Spring WebFlux on Netty.
For an internal admin tool like this, I'd actually pick traditional Spring MVC —
thread-per-request is simpler to reason about and the concurrency ceiling is way
above what a back-office tool needs. I'd only go reactive if the load profile
justified the added complexity."* That's pragmatism-over-novelty — the same trait
the playbook rewards.

---

## 8. How the demo changes (and what doesn't)

Re-reading the [live demo script](./INTERVIEW_PREP.md#3-the-live-demo-script-1820-minutes)
through a Java lens:

- **Minutes 1–13 (the whole UI walkthrough):** *unchanged.* List, filters, detail, audit log, forms, accessibility, masking — all Angular. The demo looks identical.
- **Minute 13–15 (correlation-id):** the client header is unchanged; you'd show the id appearing in the **Logback** output (with `%X{correlationId}`) instead of morgan.
- **Minute 15–20 (code deep-dive):** open the **`@Service`** with the `@Transactional` cascade instead of `employee.service.js`. The story is *stronger* in Java because of the real transaction.
- **Run command:** `mvn spring-boot:run` (or `./gradlew bootRun`) instead of `npm run start:server`; the Angular `npm start` side is unchanged.

**Bottom line to say:** *"Roughly 70% of this project — the entire frontend — is
identical regardless of backend. The backend concepts map one-to-one: layered
controllers/services/repositories, Bean Validation for the validators, ProblemDetail
for the error shape, an MDC filter for the correlation id, JPA + Envers for the
audit log, and `@Transactional` for the cascade. If anything, Java tightens a few
of my hand-rolled guarantees into framework- and database-level ones."*

---

## 9. Glossary of Java/Spring terms

| Term | Plain-English meaning |
|---|---|
| **Spring Boot** | Convention-over-configuration framework for building Java web apps/services; the de facto standard. |
| **Spring MVC** | The servlet-based (thread-per-request) web stack within Spring. |
| **Spring WebFlux** | The reactive, non-blocking web stack (Netty); closest to Node's event loop. |
| **IoC container / DI** | Spring creates and injects your objects; you declare dependencies via the constructor. |
| **`@RestController` / `@Service` / `@Repository`** | Stereotype annotations marking the controller / business / data-access layers. |
| **DTO** | Data Transfer Object — the typed shape of a request/response body. |
| **Jakarta Bean Validation** | The validation spec (`@NotBlank`, `@Email`, …); **Hibernate Validator** is its implementation. |
| **`@Valid` / `ConstraintValidator`** | Trigger validation on a DTO / write a custom validation rule. |
| **`ProblemDetail`** | Spring's built-in RFC 7807 error object. |
| **`@ControllerAdvice` / `@ExceptionHandler`** | Centralised, cross-cutting exception-to-response translation. |
| **JPA / Hibernate** | Java Persistence API (spec) / its most common implementation (the ORM). |
| **Spring Data JPA** | Generates repository implementations from interfaces; derived queries from method names. |
| **`Pageable` / `Page<T>`** | Spring Data's pagination request / result (page, size, sort, total). |
| **Hibernate Envers** | Auto-generates versioned audit history tables for `@Audited` entities. |
| **`@Transactional`** | Wraps a method in a database transaction (commit/rollback atomically). |
| **MDC** | Mapped Diagnostic Context — SLF4J's per-thread key/value bag used to stamp logs (e.g. correlation id). |
| **SLF4J / Logback** | The logging facade / the default implementation in Spring Boot. |
| **Filter / `OncePerRequestFilter`** | Servlet-level request interception (the Java analogue of Express middleware). |
| **JUnit 5 / Mockito / AssertJ** | Test framework / mocking library / fluent assertions. |
| **MockMvc / `@WebMvcTest`** | Test the web layer without a real server (analogue of supertest). |
| **Testcontainers** | Spin up real dependencies (Postgres, Redis) in Docker for high-fidelity tests. |
| **Micrometer Tracing** | Spring Boot 3's tracing facade, bridged to OpenTelemetry. |
| **Axon Framework** | A JVM framework for event sourcing + CQRS. |
| **Maven / Gradle** | Java build tools (dependency management, build, run). |

---

*See also: [INTERVIEW_PREP.md](./INTERVIEW_PREP.md) (the demo this mirrors),
[INTERVIEW_PLAYBOOK.md](./INTERVIEW_PLAYBOOK.md) (strategy + decision tree), and
[HOW_WOULD_YOU_SCALE_THIS_10X.md](./HOW_WOULD_YOU_SCALE_THIS_10X.md).*
