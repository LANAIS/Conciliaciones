import React from 'react';
import { Accounts as AccountsComponent } from '../components/accounts';
import type { NextPage } from 'next';
import withAuth from '../components/auth/withAuth';

const Accounts: NextPage = () => {
  return <AccountsComponent />;
};

export default withAuth(Accounts);
