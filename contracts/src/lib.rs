#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, Address, Env, Symbol, Vec, vec, symbol_short
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotOwner = 3,
    PlanExists = 4,
    PlanNotFound = 5,
    SubscriptionExists = 6,
    SubscriptionNotFound = 7,
    InsufficientEscrowBalance = 8,
    PaymentNotDueYet = 9,
    ArithmeticError = 10,
    NegativeAmount = 11,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Plan {
    pub id: u32,
    pub fee: i128,      // in stroops (1 XLM = 10,000,000 stroops)
    pub interval: u64, // in seconds
    pub name: Symbol,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Subscription {
    pub user: Address,
    pub plan_id: u32,
    pub start_time: u64,
    pub next_payment_due: u64,
    pub active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Owner,
    Token,
    Plan(u32),
    PlanList,
    Subscription(Address, u32),
    SubscribersList,
    UserBalance(Address),
}

#[contract]
pub struct SubscriptionContract;

#[contractimpl]
impl SubscriptionContract {
    /// Initialize the contract with its owner and the token used for subscriptions (e.g. XLM Native Asset)
    pub fn initialize(env: Env, owner: Address, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Owner) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Token, &token);
        Ok(())
    }

    /// Register a new subscription plan with a unique ID, fee, interval, and name
    pub fn register_plan(
        env: Env,
        plan_id: u32,
        fee: i128,
        interval: u64,
        name: Symbol,
    ) -> Result<(), Error> {
        let contract_owner = Self::get_owner(env.clone())?;
        contract_owner.require_auth();

        if fee <= 0 {
            return Err(Error::NegativeAmount);
        }

        let plan_key = DataKey::Plan(plan_id);
        if env.storage().persistent().has(&plan_key) {
            return Err(Error::PlanExists);
        }

        let plan = Plan {
            id: plan_id,
            fee,
            interval,
            name: name.clone(),
        };

        env.storage().persistent().set(&plan_key, &plan);

        // Update the list of plan IDs
        let list_key = DataKey::PlanList;
        let mut list: Vec<u32> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or_else(|| vec![&env]);
        list.push_back(plan_id);
        env.storage().persistent().set(&list_key, &list);

        // Emit plan registration event
        env.events().publish(
            (symbol_short!("plan_reg"), plan_id),
            (fee, interval, name),
        );

        Ok(())
    }

    /// Subscribe to a plan. Requires immediate payment of the first interval from the subscriber's wallet.
    pub fn subscribe(env: Env, user: Address, plan_id: u32) -> Result<(), Error> {
        user.require_auth();

        let plan_key = DataKey::Plan(plan_id);
        if !env.storage().persistent().has(&plan_key) {
            return Err(Error::PlanNotFound);
        }

        let plan: Plan = env.storage().persistent().get(&plan_key).unwrap();

        let sub_key = DataKey::Subscription(user.clone(), plan_id);
        if env.storage().persistent().has(&sub_key) {
            let existing: Subscription = env.storage().persistent().get(&sub_key).unwrap();
            if existing.active {
                return Err(Error::SubscriptionExists);
            }
        }

        let token_address = Self::get_token(env.clone())?;
        let owner_address = Self::get_owner(env.clone())?;

        // Pull initial payment from subscriber directly to owner address
        let token_client = soroban_sdk::token::Client::new(&env, &token_address);
        token_client.transfer(&user, &owner_address, &plan.fee);

        let now = env.ledger().timestamp();
        let next_due = now.checked_add(plan.interval).ok_or(Error::ArithmeticError)?;

        let subscription = Subscription {
            user: user.clone(),
            plan_id,
            start_time: now,
            next_payment_due: next_due,
            active: true,
        };

        env.storage().persistent().set(&sub_key, &subscription);

        // Add user/plan to subscribers registry list if not present
        let list_key = DataKey::SubscribersList;
        let mut list: Vec<(Address, u32)> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or_else(|| vec![&env]);
        
        let mut exists = false;
        for item in list.iter() {
            if item.0 == user && item.1 == plan_id {
                exists = true;
                break;
            }
        }
        if !exists {
            list.push_back((user.clone(), plan_id));
            env.storage().persistent().set(&list_key, &list);
        }

        // Emit new subscription event
        env.events().publish(
            (symbol_short!("sub_new"), user.clone(), plan_id),
            next_due,
        );

        Ok(())
    }

    /// Deposit funds into the contract to fund automated collections
    pub fn deposit_funds(env: Env, user: Address, amount: i128) -> Result<(), Error> {
        user.require_auth();

        if amount <= 0 {
            return Err(Error::NegativeAmount);
        }

        let token_address = Self::get_token(env.clone())?;
        let token_client = soroban_sdk::token::Client::new(&env, &token_address);

        // Move funds from user wallet into the contract escrow account
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        let balance_key = DataKey::UserBalance(user.clone());
        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0);
        let new_balance = current_balance
            .checked_add(amount)
            .ok_or(Error::ArithmeticError)?;

        env.storage().persistent().set(&balance_key, &new_balance);

        // Emit deposit event
        env.events().publish(
            (symbol_short!("deposit"), user.clone()),
            amount,
        );

        Ok(())
    }

    /// Withdraw unused deposited escrow funds from the contract
    pub fn withdraw_funds(env: Env, user: Address, amount: i128) -> Result<(), Error> {
        user.require_auth();

        if amount <= 0 {
            return Err(Error::NegativeAmount);
        }

        let balance_key = DataKey::UserBalance(user.clone());
        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0);

        if current_balance < amount {
            return Err(Error::InsufficientEscrowBalance);
        }

        let new_balance = current_balance
            .checked_sub(amount)
            .ok_or(Error::ArithmeticError)?;
        env.storage().persistent().set(&balance_key, &new_balance);

        let token_address = Self::get_token(env.clone())?;
        let token_client = soroban_sdk::token::Client::new(&env, &token_address);

        // Return funds from the contract escrow back to user's wallet
        token_client.transfer(&env.current_contract_address(), &user, &amount);

        // Emit withdraw event
        env.events().publish(
            (symbol_short!("withdraw"), user.clone()),
            amount,
        );

        Ok(())
    }

    /// Renew manually using wallet funds. Adds another full interval to next_payment_due.
    pub fn renew(env: Env, user: Address, plan_id: u32) -> Result<(), Error> {
        user.require_auth();

        let plan_key = DataKey::Plan(plan_id);
        let plan: Plan = env
            .storage()
            .persistent()
            .get(&plan_key)
            .ok_or(Error::PlanNotFound)?;

        let sub_key = DataKey::Subscription(user.clone(), plan_id);
        let mut subscription: Subscription = env
            .storage()
            .persistent()
            .get(&sub_key)
            .ok_or(Error::SubscriptionNotFound)?;

        if !subscription.active {
            return Err(Error::SubscriptionNotFound);
        }

        let token_address = Self::get_token(env.clone())?;
        let owner_address = Self::get_owner(env.clone())?;

        // Pay directly to owner G-address
        let token_client = soroban_sdk::token::Client::new(&env, &token_address);
        token_client.transfer(&user, &owner_address, &plan.fee);

        let now = env.ledger().timestamp();
        let base_time = if now > subscription.next_payment_due {
            now
        } else {
            subscription.next_payment_due
        };
        let next_due = base_time.checked_add(plan.interval).ok_or(Error::ArithmeticError)?;
        subscription.next_payment_due = next_due;

        env.storage().persistent().set(&sub_key, &subscription);

        // Emit renewal event
        env.events().publish(
            (symbol_short!("renewed"), user.clone(), plan_id),
            (plan.fee, next_due),
        );

        Ok(())
    }

    /// Executed by owner to collect subscription fee from the user's contract-escrow balance.
    /// Due date must have elapsed. Updates next due date by adding interval.
    pub fn collect_payment(env: Env, owner: Address, user: Address, plan_id: u32) -> Result<(), Error> {
        owner.require_auth();

        let contract_owner = Self::get_owner(env.clone())?;
        if owner != contract_owner {
            return Err(Error::NotOwner);
        }

        let plan_key = DataKey::Plan(plan_id);
        let plan: Plan = env
            .storage()
            .persistent()
            .get(&plan_key)
            .ok_or(Error::PlanNotFound)?;

        let sub_key = DataKey::Subscription(user.clone(), plan_id);
        let mut subscription: Subscription = env
            .storage()
            .persistent()
            .get(&sub_key)
            .ok_or(Error::SubscriptionNotFound)?;

        if !subscription.active {
            return Err(Error::SubscriptionNotFound);
        }

        let now = env.ledger().timestamp();
        if now < subscription.next_payment_due {
            return Err(Error::PaymentNotDueYet);
        }

        let balance_key = DataKey::UserBalance(user.clone());
        let user_balance: i128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0);

        if user_balance < plan.fee {
            // Subscription lapses due to lack of balance
            subscription.active = false;
            env.storage().persistent().set(&sub_key, &subscription);
            return Err(Error::InsufficientEscrowBalance);
        }

        // Deduct fee from user escrow balance inside contract
        let new_balance = user_balance
            .checked_sub(plan.fee)
            .ok_or(Error::ArithmeticError)?;
        env.storage().persistent().set(&balance_key, &new_balance);

        // Transfer funds from contract account directly to the owner G-address
        let token_address = Self::get_token(env.clone())?;
        let token_client = soroban_sdk::token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &contract_owner, &plan.fee);

        // Update the subscription's next due date
        let next_due = subscription
            .next_payment_due
            .checked_add(plan.interval)
            .ok_or(Error::ArithmeticError)?;
        subscription.next_payment_due = next_due;

        env.storage().persistent().set(&sub_key, &subscription);

        // Emit collection event
        env.events().publish(
            (symbol_short!("collect"), user.clone(), plan_id),
            (plan.fee, next_due),
        );

        Ok(())
    }

    /// Cancel subscription immediately
    pub fn cancel_subscription(env: Env, user: Address, plan_id: u32) -> Result<(), Error> {
        user.require_auth();

        let sub_key = DataKey::Subscription(user.clone(), plan_id);
        let mut subscription: Subscription = env
            .storage()
            .persistent()
            .get(&sub_key)
            .ok_or(Error::SubscriptionNotFound)?;

        if !subscription.active {
            return Err(Error::SubscriptionNotFound);
        }

        subscription.active = false;
        env.storage().persistent().set(&sub_key, &subscription);

        // Emit cancel event
        env.events().publish(
            (symbol_short!("sub_canc"), user.clone(), plan_id),
            (),
        );

        Ok(())
    }

    // --- GETTER FUNCTIONS ---

    pub fn get_owner(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Owner)
            .ok_or(Error::NotInitialized)
    }

    pub fn get_token(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)
    }

    pub fn get_plan(env: Env, plan_id: u32) -> Option<Plan> {
        let plan_key = DataKey::Plan(plan_id);
        env.storage().persistent().get(&plan_key)
    }

    pub fn get_subscription(env: Env, user: Address, plan_id: u32) -> Option<Subscription> {
        let sub_key = DataKey::Subscription(user, plan_id);
        env.storage().persistent().get(&sub_key)
    }

    pub fn get_user_balance(env: Env, user: Address) -> i128 {
        let balance_key = DataKey::UserBalance(user);
        env.storage().persistent().get(&balance_key).unwrap_or(0)
    }

    pub fn get_all_plans(env: Env) -> Vec<Plan> {
        let list_key = DataKey::PlanList;
        let list: Vec<u32> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or_else(|| vec![&env]);
        
        let mut plans = vec![&env];
        for id in list.iter() {
            if let Some(plan) = Self::get_plan(env.clone(), id) {
                plans.push_back(plan);
            }
        }
        plans
    }

    pub fn get_all_subscriptions(env: Env) -> Vec<Subscription> {
        let list_key = DataKey::SubscribersList;
        let list: Vec<(Address, u32)> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or_else(|| vec![&env]);
        
        let mut subs = vec![&env];
        for item in list.iter() {
            if let Some(sub) = Self::get_subscription(env.clone(), item.0, item.1) {
                subs.push_back(sub);
            }
        }
        subs
    }
}

// --- UNIT TESTS ---
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::token;
    use soroban_sdk::Env;

    #[test]
    fn test_setup_and_subscription() {
        let env = Env::default();
        env.mock_all_auths();

        let owner = Address::generate(&env);
        let user = Address::generate(&env);

        // Register custom stellar native asset contract (XLM equivalent)
        let token_admin = Address::generate(&env);
        let token_address = env.register_stellar_asset_contract(token_admin.clone());
        let token_client = token::Client::new(&env, &token_address);
        let token_admin_client = token::StellarAssetContractClient::new(&env, &token_address);

        // Mint initial tokens for the user G-address (100 XLM / stroops)
        token_admin_client.mint(&user, &1_000_000_000);

        // Register and initialize contract
        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);

        client.initialize(&owner, &token_address);

        // Verify contract initialization
        assert_eq!(client.get_owner(), owner);
        assert_eq!(client.get_token(), token_address);

        // Register plan (Monthly Plan: ID 1, fee 20 XLM (200,000,000 stroops), interval 30 days = 2,592,000 seconds)
        let plan_fee = 200_000_000;
        let plan_interval = 2_592_000;
        client.register_plan(&1, &plan_fee, &plan_interval, &Symbol::new(&env, "Monthly"));

        // Verify registered plan
        let plan = client.get_plan(&1).unwrap();
        assert_eq!(plan.fee, plan_fee);
        assert_eq!(plan.interval, plan_interval);

        // Subscribe to Plan 1
        client.subscribe(&user, &1);

        // Verify direct payment from subscriber to owner G-address
        assert_eq!(token_client.balance(&user), 800_000_000); // 100 - 20 = 80 XLM
        assert_eq!(token_client.balance(&owner), 200_000_000); // 20 XLM received

        // Verify subscriber status
        let sub = client.get_subscription(&user, &1).unwrap();
        assert!(sub.active);
        assert_eq!(sub.next_payment_due, env.ledger().timestamp() + plan_interval);
    }

    #[test]
    fn test_escrow_deposit_and_collection() {
        let env = Env::default();
        env.mock_all_auths();

        let owner = Address::generate(&env);
        let user = Address::generate(&env);

        let token_admin = Address::generate(&env);
        let token_address = env.register_stellar_asset_contract(token_admin.clone());
        let token_client = token::Client::new(&env, &token_address);
        let token_admin_client = token::StellarAssetContractClient::new(&env, &token_address);

        token_admin_client.mint(&user, &1_000_000_000); // 100 XLM

        let contract_id = env.register_contract(None, SubscriptionContract);
        let client = SubscriptionContractClient::new(&env, &contract_id);

        client.initialize(&owner, &token_address);

        // Register plan (Weekly Plan: ID 2, fee 5 XLM (50,000,000 stroops), interval 7 days = 604,800 seconds)
        let plan_fee = 50_000_000;
        let plan_interval = 604_800;
        client.register_plan(&2, &plan_fee, &plan_interval, &Symbol::new(&env, "Weekly"));

        // Deposit funds into user escrow (e.g. 50 XLM)
        client.deposit_funds(&user, &500_000_000);
        assert_eq!(client.get_user_balance(&user), 500_000_000);
        assert_eq!(token_client.balance(&user), 500_000_000); // Wallet has 50 XLM left

        // Subscribe to Plan 2 (Requires 1st payment directly from wallet)
        client.subscribe(&user, &2);
        assert_eq!(token_client.balance(&user), 450_000_000); // 50 - 5 = 45 XLM
        assert_eq!(token_client.balance(&owner), 50_000_000); // Owner has 5 XLM

        // Try to trigger collection before due date - should fail
        let collect_res = client.try_collect_payment(&owner, &user, &2);
        assert!(collect_res.is_err());

        // Travel forward in time (beyond 7 days)
        env.ledger().set_timestamp(env.ledger().timestamp() + plan_interval + 1);

        // Trigger payment collection by owner
        client.collect_payment(&owner, &user, &2);

        // Verify balance changes
        assert_eq!(client.get_user_balance(&user), 450_000_000); // Escrow reduced by 5 XLM
        assert_eq!(token_client.balance(&owner), 100_000_000); // Owner got another 5 XLM (total 10)

        // Verify next payment due updated
        let sub = client.get_subscription(&user, &2).unwrap();
        assert_eq!(sub.next_payment_due, env.ledger().timestamp() + plan_interval - 1);
    }
}
