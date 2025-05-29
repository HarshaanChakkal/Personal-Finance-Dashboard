from sqlalchemy import Column, Integer, String, Boolean, Float, Text, ForeignKey, DateTime, Date
from sqlalchemy.orm import relationship
from database import Base
from sqlalchemy.sql import func
class Category(Base):
    __tablename__ = 'categories'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    keywords = Column(Text)
    created_at = Column(DateTime, default=func.now())

    transactions = relationship('Transaction', back_populates='category')

class Transaction(Base):
    __tablename__ = 'transactions'

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date)
    details = Column(Text)
    amount = Column(Float)
    transaction_type = Column(String)
    category_id = Column(Integer, ForeignKey("categories.id"))
    created_at = Column(DateTime, default=func.now())

    category = relationship('Category', back_populates='transactions')

class BankStatement(Base):
    __tablename__ = 'bank_statements'

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    upload_date = Column(DateTime, default=func.now())
    total_transactions = Column(Integer)
    processed = Column(Boolean, default=False)