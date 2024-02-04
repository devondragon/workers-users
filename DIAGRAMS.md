# Diagrams

## Sequence Diagrams
These diagrams are simplified and assume that relevant validation is done, errors are handled, etc...

### Registration Sequence Diagram
```mermaid
sequenceDiagram
    participant CB as Client Browser
    participant UMW as user-mgmt Worker API
    participant UMD as user-mgmt D1 Database
    participant SSW as session-state Worker API
    participant SSKV as session-state KV
    CB->>UMW: Registration Form POST
    UMW->>UMD: Persist User Data
    UMD->>UMW: Success
    UMW->>CB: Successful Registration
```

### Login Sequence Diagram
```mermaid
sequenceDiagram
    participant CB as Client Browser
    participant UMW as user-mgmt Worker API
    participant UMD as user-mgmt D1 Database
    participant SSW as session-state Worker API
    participant SSKV as session-state KV
    CB->>UMW: Login Form POST
    UMW->>UMD: Lookup User Data
    UMD->>UMW: Success
    UMW->>SSW: Create Session (user data)
    SSW->>SSKV: Store Session Data
    SSKV->>SSW: Success
    SSW->>UMW: Success
    UMW->>CB: Login Success
    Note over CB,UMW: Response sets sessionId Cookie
```

### Logged In Get Session State Sequence Diagram
```mermaid
sequenceDiagram
    participant CB as Client Browser
    participant UMW as user-mgmt Worker API
    participant SSW as session-state Worker API
    participant SSKV as session-state KV
    CB->>UMW: Any API Call to App
    Note over CB,UMW: Request passes sessionId Cookie
    UMW->>SSW: Get Session State
    Note over UMW,SSW: Using sessionId
    SSW->>SSKV: Get Session Data
    SSKV->>SSW: Session Data
    SSW->>UMW: Session Data
    UMW->>UMW: Use Session Data
    UMW->>CB: API Response
```
