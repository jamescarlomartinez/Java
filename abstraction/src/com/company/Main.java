package com.company;

public abstract class Main
{
    abstract void love();
}
class nextclass extends Main
{
    void love()
    {
        System.out.println("this is abstraction :)");
    }
    public static void main(String[] args) {
        Main abs = new nextclass();
        abs.love();

    }
}
